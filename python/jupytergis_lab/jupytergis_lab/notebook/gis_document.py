from __future__ import annotations

import json
import logging
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal
from urllib.parse import urlparse
from uuid import uuid4

import requests
from IPython.display import display
from jupytergis_core.schema import (
    IGeoJSONSource,
    IGeoPackageRasterSource,
    IGeoPackageVectorSource,
    IGeoParquetSource,
    IGeoTiffLayer,
    IGeoTiffSource,
    IGeoZarrLayer,
    IGeoZarrSource,
    IHillshadeLayer,
    IImageLayer,
    IImageSource,
    IMarkerSource,
    IOpenEOTileLayer,
    IOpenEOTileSource,
    IRasterDemSource,
    IRasterLayer,
    IRasterSource,
    IStorySegmentLayer,
    IVectorLayer,
    IVectorTileLayer,
    IVectorTileSource,
    IWmsTileSource,
    LayerType,
    SourceType,
)
from pycrdt import Array, Map
from pydantic import BaseModel
from sidecar import Sidecar
from ypywidgets.comm import CommWidget

from jupytergis_lab.notebook.symbology import (
    SymbologyInput,
    to_symbology_state,
)
from jupytergis_lab.notebook.utils import get_gpkg_layers

if TYPE_CHECKING:
    from jupyter_tiler.titiler import (
        BaseAlgorithm,
        DataArray,
        TiTilerServer,
    )


logger = logging.getLogger(__file__)

# Layer/source types that have no QGIS equivalent and so cannot be round-tripped
# through the QGIS format. Adding them is blocked while a QGIS file is open,
# mirroring the features disabled in the UI.
QGIS_UNSUPPORTED_TYPES = {
    LayerType.OpenEOTileLayer,
    LayerType.GeoZarrLayer,
    LayerType.StorySegmentLayer,
    SourceType.OpenEOTileSource,
    SourceType.GeoZarrSource,
}


def reversed_tree(root):
    if isinstance(root, list):
        return reversed([reversed_tree(el) for el in root])
    return root


def _extract_layer_name(path: str | Path) -> str:
    """Extract a meaningful layer name from a file path or URL.

    Examples:
        "/path/to/earthquakes.geojson" → "earthquakes"
        "https://example.com/data/france_regions.geojson" → "france_regions"
        "hillshade.tif" → "hillshade"
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            → "tile.openstreetmap.org"

    """
    if isinstance(path, Path):
        path = str(path)

    parsed = urlparse(path)

    if parsed.scheme and any(token in parsed.path for token in ("{z}", "{x}", "{y}")):
        return parsed.netloc

    filename = path.rstrip("/").split("/")[-1]

    name_without_ext = filename.rsplit(".", 1)[0]

    return name_without_ext or filename


class GISDocument(CommWidget):
    """Create a new GISDocument object.

    :param path: the path to the file that you would like to open. If not provided, a new ephemeral widget will be created.

    Collaborative client state from the front end is mirrored into :mod:`ypywidgets`
    ``Awareness`` on the kernel. Subscribe with ``on_awareness_change(callback)``
    (returns a subscription id; use ``unobserve_awareness(id)`` to remove). The
    current snapshot is available as ``awareness.states`` on the underlying
    ``pycrdt.Awareness`` via the inherited ``awareness`` property.
    """

    tile_server: None | TiTilerServer

    def __init__(
        self,
        path: str | Path | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        zoom: float | None = None,
        extent: list[float] | None = None,
        bearing: float | None = None,
        pitch: float | None = None,
        projection: str | None = None,
    ):
        if isinstance(path, Path):
            path = str(path)

        self._path = path

        super().__init__(
            comm_metadata={
                "ymodel_name": "@jupytergis:widget",
                **self._make_comm(path=path),
            },
        )

        self.ydoc["layers"] = self._layers = Map()
        self.ydoc["sources"] = self._sources = Map()
        self.ydoc["options"] = self._options = Map(
            {
                "latitude": 0,
                "longitude": 0,
                "zoom": 0,
                "bearing": 0,
                "pitch": 0,
                "projection": "EPSG:3857",
            },
        )
        self.ydoc["layerTree"] = self._layerTree = Array()
        self.ydoc["metadata"] = self._metadata = Map()

        if latitude is not None:
            self._options["latitude"] = latitude
        if longitude is not None:
            self._options["longitude"] = longitude
        if extent is not None:
            self._options["extent"] = extent
        if zoom is not None:
            self._options["zoom"] = zoom
        if bearing is not None:
            self._options["bearing"] = bearing
        if pitch is not None:
            self._options["pitch"] = pitch
        if projection is not None:
            self._options["projection"] = projection

        self.tile_server = None

    @property
    def layers(self) -> dict:
        """Get the layer list"""
        return self._layers.to_py()

    @property
    def layer_tree(self) -> list[str | dict]:
        """Get the layer tree"""
        return self._layerTree.to_py()

    @property
    def _is_qgis_document(self) -> bool:
        """Whether the document is backed by a QGIS (`.qgs`/`.qgz`) file."""
        return str(self._path or "").lower().endswith((".qgs", ".qgz"))

    def _ensure_qgis_supported(self, object_type) -> None:
        """Raise if ``object_type`` cannot be round-tripped through QGIS while a
        QGIS file is open. Mirrors the features disabled in the UI.
        """
        if self._is_qgis_document and object_type in QGIS_UNSUPPORTED_TYPES:
            name = getattr(object_type, "value", object_type)
            raise RuntimeError(
                f"'{name}' is not possible in QGIS files. Convert it to jGIS first.",
            )

    def _ensure_symbology_qgis_supported(self, symbology_state) -> None:
        """Raise if ``symbology_state`` relies on render-time expressions while a
        QGIS file is open. Expression-based symbology has no QGIS equivalent and
        cannot be round-tripped, mirroring the feature disabled in the UI.
        """
        if not self._is_qgis_document or symbology_state is None:
            return

        def _has_expression(value) -> bool:
            if isinstance(value, dict):
                if value.get("scheme") == "expression":
                    return True
                return any(_has_expression(v) for v in value.values())
            if isinstance(value, (list, tuple)):
                return any(_has_expression(v) for v in value)
            return False

        if _has_expression(symbology_state):
            raise RuntimeError(
                "Expression-based symbology is not possible in QGIS files. "
                "Convert it to jGIS first.",
            )

    def sidecar(
        self,
        *,
        title: str = "JupyterGIS sidecar",
        anchor: Literal[
            "split-right",
            "split-left",
            "split-top",
            "split-bottom",
            "tab-before",
            "tab-after",
            "right",
        ] = "split-right",
    ):
        """Open the document in a new sidecar panel.

        :param anchor: Where to position the new sidecar panel.
        """
        sidecar = Sidecar(title=title, anchor=anchor)
        with sidecar:
            display(self)

    def export_to_qgis(self, path: str | Path) -> bool:
        # Lazy import, jupytergis_qgis of qgis may not be installed
        from jupytergis_qgis.qgis_loader import export_project_to_qgis

        if isinstance(path, Path):
            path = str(path)

        virtual_file = self.to_py()
        virtual_file["layerTree"] = reversed_tree(virtual_file["layerTree"])
        del virtual_file["metadata"]

        return export_project_to_qgis(path, virtual_file)

    def add_raster_layer(
        self,
        url: str,
        name: str | None = None,
        attribution: str = "",
        opacity: float = 1,
        url_parameters: dict[str, Any] | None = None,
    ):
        """Add a Raster Layer to the document.

        :param name: The name that will be used for the object in the document.
        :param url: The tiles url.
        :param attribution: The attribution.
        :param opacity: The opacity, between 0 and 1.
        :param url_parameters: Extra URL parameters for tile requests.
        """
        # Extract name from URL if not provided
        if name is None:
            name = _extract_layer_name(url)

        source = {
            "type": SourceType.RasterSource,
            "name": f"{name} Source",
            "parameters": {
                "url": url,
                "minZoom": 0,
                "maxZoom": 24,
                "attribution": attribution,
                "htmlAttribution": attribution,
                "provider": "",
                "bounds": [],
                "urlParameters": url_parameters or {},
            },
        }

        source_id = self._add_source(OBJECT_FACTORY.create_source(source, self))

        layer = {
            "type": LayerType.RasterLayer,
            "name": name,
            "visible": True,
            "parameters": {"source": source_id, "opacity": opacity, "color": {}},
        }

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_vectortile_layer(
        self,
        url: str,
        name: str | None = None,
        attribution: str = "",
        min_zoom: int = 0,
        max_zoom: int = 24,
        opacity: float = 1,
        symbology: SymbologyInput = None,
    ):
        """Add a Vector Tile Layer to the document.

        :param name: The name that will be used for the object in the document.
        :param url: The tiles url.
        :param attribution: The attribution.
        :param opacity: The opacity, between 0 and 1.
        :param symbology: The symbology configuration to persist with the layer.
        """
        # Extract name from URL if not provided
        if name is None:
            name = _extract_layer_name(url)

        source = {
            "type": SourceType.VectorTileSource,
            "name": f"{name} Source",
            "parameters": {
                "url": url,
                "minZoom": min_zoom,
                "maxZoom": max_zoom,
                "attribution": attribution,
                "htmlAttribution": attribution,
                "provider": "",
                "bounds": [],
                "urlParameters": {},
            },
        }

        source_id = self._add_source(OBJECT_FACTORY.create_source(source, self))

        layer = {
            "type": LayerType.VectorTileLayer,
            "name": name,
            "visible": True,
            "parameters": {
                "source": source_id,
                "opacity": opacity,
            },
        }

        symbology_state = to_symbology_state(symbology)
        if symbology_state is not None:
            layer["parameters"]["symbologyState"] = symbology_state

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_geojson_layer(
        self,
        path: str | Path | None = None,
        data: dict | None = None,
        name: str | None = None,
        opacity: float = 1,
        symbology: SymbologyInput = None,
    ):
        """Add a GeoJSON Layer to the document.

        :param name: The name that will be used for the object in the document.
        :param path: The path to the JSON file or URL to embed into the jGIS file.
        :param data: The raw GeoJSON data to embed into the jGIS file.
        :param opacity: The opacity, between 0 and 1.
        :param symbology: The symbology configuration to persist with the layer.
        """
        if isinstance(path, Path) and data is not None:
            raise ValueError("Cannot create a GeoJSON layer without data")

        if path is not None and data is not None:
            raise ValueError("Cannot set GeoJSON layer data and path at the same time")

        parameters = {}

        if path is not None:
            if path.startswith("http://") or path.startswith("https://"):
                response = requests.get(path)
                response.raise_for_status()
                parameters["path"] = path
            else:
                # We cannot put the path to the file in the model
                # We don't know where the kernel runs/live
                # The front-end would have no way of finding the file reliably
                with open(path) as fobj:
                    parameters["data"] = json.load(fobj)

        if data is not None:
            parameters["data"] = data

        # Extract name from path if not provided
        if name is None and path is not None:
            name = _extract_layer_name(path)

        source = {
            "type": SourceType.GeoJSONSource,
            "name": f"{name} Source",
            "parameters": parameters,
        }

        source_id = self._add_source(OBJECT_FACTORY.create_source(source, self))

        layer = {
            "type": LayerType.VectorLayer,
            "name": name,
            "visible": True,
            "parameters": {
                "source": source_id,
                "opacity": opacity,
            },
        }

        symbology_state = to_symbology_state(symbology)
        if symbology_state is not None:
            layer["parameters"]["symbologyState"] = symbology_state

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_openeo_tile_layer(
        self,
        graph,
        name: str | None = None,
        opacity: float = 1,
    ):
        # Persist the bearer token alongside the server url so a connection
        # opened here from the notebook is reused by the frontend without the
        # user having to sign in a second time from the UI. The bearer is a
        # session identifier, not long-lived credentials.
        source = {
            "type": SourceType.OpenEOTileSource,
            "name": f"{name} Source" if name is not None else "OpenEO Tiles Source",
            "parameters": {
                "processGraph": graph.flat_graph(),
                "serverUrl": graph.connection.root_url,
                "authBearer": graph.connection.auth.bearer,
            },
        }

        source_id = self._add_source(OBJECT_FACTORY.create_source(source, self))

        layer = {
            "type": LayerType.OpenEOTileLayer,
            "name": name if name is not None else "OpenEO Tiles Layer",
            "visible": True,
            "parameters": {"source": source_id, "opacity": opacity},
        }

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_image_layer(
        self,
        url: str,
        coordinates: [],
        name: str | None = None,
        opacity: float = 1,
    ):
        """Add a Image Layer to the document.

        :param name: The name that will be used for the object in the document.
        :param url: The image url.
        :param coordinates: Corners of image specified in longitude, latitude pairs.
        :param opacity: The opacity, between 0 and 1.
        """
        if url is None or coordinates is None:
            raise ValueError("URL and Coordinates are required")
        # Extract name from URL if not provided
        if name is None:
            name = _extract_layer_name(url)

        source = {
            "type": SourceType.ImageSource,
            "name": f"{name} Source",
            "parameters": {"path": url, "coordinates": coordinates},
        }

        source_id = self._add_source(OBJECT_FACTORY.create_source(source, self))

        layer = {
            "type": LayerType.ImageLayer,
            "name": name,
            "visible": True,
            "parameters": {"source": source_id, "opacity": opacity},
        }

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_geotiff_layer(
        self,
        url: str,
        min: int = None,
        max: int = None,
        name: str | None = None,
        normalize: bool = True,
        wrapX: bool = False,
        attribution: str = "",
        opacity: float = 1.0,
        symbology: SymbologyInput = None,
    ):
        """Add a GeoTIFF layer.

        :param url: URL of the GeoTIFF
        :param min: Minimum pixel value to be displayed, defaults to letting the map display set the value
        :param max: Maximum pixel value to be displayed, defaults to letting the map display set the value
        :param name: The name that will be used for the object in the document, defaults to "GeoTIFF Layer"
        :param normalize: Select whether to normalize values between 0..1, if false than min/max have no effect, defaults to True
        :param wrapX: Render tiles beyond the tile grid extent, defaults to False
        :param opacity: The opacity, between 0 and 1, defaults to 1.0
        :param symbology: The symbology configuration to persist with the layer.
        """
        # Extract name from URL if not provided
        if name is None:
            name = _extract_layer_name(url)

        source = {
            "type": SourceType.GeoTiffSource,
            "name": f"{name} Source",
            "parameters": {
                "urls": [{"url": url, "min": min, "max": max}],
                "normalize": normalize,
                "wrapX": wrapX,
            },
        }
        source_id = self._add_source(OBJECT_FACTORY.create_source(source, self))

        layer = {
            "type": LayerType.GeoTiffLayer,
            "name": name,
            "visible": True,
            "parameters": {
                "source": source_id,
                "opacity": opacity,
            },
        }

        symbology_state = to_symbology_state(symbology)
        if symbology_state is not None:
            layer["parameters"]["symbologyState"] = symbology_state

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_geoZarr_layer(
        self,
        url: str,
        bands: list[str] | None = None,
        name: str = "Zarr Layer",
        opacity: float = 1.0,
        gamma: float = 1,
        wrap_x: bool = False,
        symbology: SymbologyInput = None,
    ):
        """Add a Zarr layer

        :param url: URL of the GeoZarr.
        :param bands: Named band identifiers to load (e.g. ['b04','b03','b02']). When None or empty, all bands are loaded in stored order.
        :param name: The name that will be used for the object in the document, defaults to "GeoTIFF Layer"
        :param opacity: Layer opacity between 0 and 1.
        :param gamma: Gamma correction applied to all bands (default 1).
        :param wrap_x: Render tiles beyond the tile grid extent, defaults to False
        :param symbology: The symbology configuration to persist with the layer.
        """
        source = {
            "type": SourceType.GeoZarrSource,
            "name": f"{name} Source",
            "parameters": {
                "url": url,
                "bands": bands or [],
                "wrapX": wrap_x,
            },
        }

        source_id = self._add_source(OBJECT_FACTORY.create_source(source, self))

        layer = {
            "type": LayerType.GeoZarrLayer,
            "name": name,
            "visible": True,
            "parameters": {
                "source": source_id,
                "opacity": opacity,
                "gamma": gamma,
            },
        }

        symbology_state = to_symbology_state(symbology)
        if symbology_state is not None:
            layer["parameters"]["symbologyState"] = symbology_state

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_hillshade_layer(
        self,
        url: str,
        name: str | None = None,
        urlParameters: dict | None = None,
        attribution: str = "",
    ):
        """Add a hillshade layer

        :param url: URL of the hillshade layer
        :param name: The name that will be used for the object in the document, defaults to "Hillshade Layer"
        :param attribution: The attribution.
        """
        if urlParameters is None:
            urlParameters = {}
        # Extract name from URL if not provided
        if name is None:
            name = _extract_layer_name(url)

        source = {
            "type": SourceType.RasterDemSource,
            "name": f"{name} Source",
            "parameters": {
                "url": url,
                "attribution": attribution,
                "urlParameters": urlParameters,
            },
        }
        source_id = self._add_source(OBJECT_FACTORY.create_source(source, self))

        layer = {
            "type": LayerType.HillshadeLayer,
            "name": name,
            "visible": True,
            "parameters": {"source": source_id},
        }

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_geoparquet_layer(
        self,
        path: str,
        name: str | None = None,
        opacity: float = 1,
        symbology: SymbologyInput = None,
    ):
        """Add a GeoParquet Layer to the document.

        :param path: The path to the GeoParquet file to embed into the jGIS file.
        :param name: The name that will be used for the object in the document.
        :param opacity: The opacity, between 0 and 1.
        :param symbology: The symbology configuration to persist with the layer.
        """
        # Extract name from path if not provided
        if name is None:
            name = _extract_layer_name(path)

        source = {
            "type": SourceType.GeoParquetSource,
            "name": f"{name} Source",
            "parameters": {"path": path},
        }

        source_id = self._add_source(OBJECT_FACTORY.create_source(source, self))

        layer = {
            "type": LayerType.VectorLayer,
            "name": name,
            "visible": True,
            "parameters": {
                "source": source_id,
                "opacity": opacity,
            },
        }

        symbology_state = to_symbology_state(symbology)
        if symbology_state is not None:
            layer["parameters"]["symbologyState"] = symbology_state

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_geopackage_vector_layer(
        self,
        path: str,
        table_names: list[str] | str | None = None,
        name: str | None = None,
        type: Literal["circle", "fill", "line"] = "line",
        opacity: float = 1,
        symbology: SymbologyInput = None,
    ):
        """Add a GeoPackage Vector Layer to the document.

        :param path: The path to the GeoPackage file to embed into the jGIS file.
        :param table_names: A list of table names to create layers for.
        :param name: The name that will be used for the object in the document.
        :param type: The type of the vector layer to create.
        :param opacity: The opacity, between 0 and 1.
        :param symbology: The symbology configuration to persist with the layers.
        """
        if table_names is None:
            table_names = get_gpkg_layers(path, "features")
        elif isinstance(table_names, str):
            table_names = [table_names]
        # Extract name from path if not provided
        if name is None:
            name = _extract_layer_name(path)

        layer_ids = []

        if "projection" in self._options:
            projection = self._options["projection"]
        else:
            projection = "EPSG:3857"

        symbology_state = to_symbology_state(symbology)

        for table_name in table_names:
            source = {
                "type": SourceType.GeoPackageVectorSource,
                "name": f"{name} {table_name} Source",
                "parameters": {
                    "path": path,
                    "tables": table_name,
                    "projection": projection,
                },
            }

            source_id = str(uuid4()) + "/" + str(table_name)

            self._add_source(OBJECT_FACTORY.create_source(source, self), source_id)

            layer = {
                "type": LayerType.VectorLayer,
                "name": f"{name} {table_name} Layer",
                "visible": True,
                "parameters": {
                    "source": source_id,
                    "type": type,
                    "opacity": opacity,
                },
            }

            if symbology_state is not None:
                layer["parameters"]["symbologyState"] = symbology_state

            layer_id = str(uuid4()) + "/" + str(table_name)
            layer_ids.append(
                self._add_layer(OBJECT_FACTORY.create_layer(layer, self), layer_id),
            )

        return layer_ids

    def add_geopackage_raster_layer(
        self,
        path: str,
        table_names: list[str] | str | None = None,
        name: str | None = None,
        attribution: str = "",
        opacity: float = 1,
    ):
        """Add a GeoPackage Raster Layer to the document.

        :param path: The tiles path.
        :param table_names: A list of table names to create layers for.
        :param name: The name that will be used for the object in the document.
        :param attribution: The attribution.
        :param opacity: The opacity, between 0 and 1.
        """
        if isinstance(table_names, str):
            table_names = [part.strip() for part in table_names.split(",")]

        if not table_names:
            table_names = get_gpkg_layers(path, "tiles")
        # Extract name from path if not provided
        if name is None:
            name = _extract_layer_name(path)

        layer_ids = []

        for table_name in table_names:
            source = {
                "type": SourceType.GeoPackageRasterSource,
                "name": f"{name} {table_name} Source",
                "parameters": {"path": path, "tables": table_name},
            }

            source_id = str(uuid4()) + "/" + str(table_name)

            self._add_source(OBJECT_FACTORY.create_source(source, self), source_id)

            layer = {
                "type": LayerType.RasterLayer,
                "name": f"{name} {table_name} Layer",
                "visible": True,
                "parameters": {
                    "source": source_id,
                    "opacity": opacity,
                    "attribution": attribution,
                },
            }

            layer_id = str(uuid4()) + "/" + str(table_name)
            layer_ids.append(
                self._add_layer(OBJECT_FACTORY.create_layer(layer, self), layer_id),
            )

        return layer_ids

    async def add_data_array_layer(
        self,
        data_array: DataArray,
        *,
        name: str = "Data Array layer",
        colormap_name: str = "viridis",
        colormap_range: tuple[float, float] | None = None,
        opacity: float = 1,
        tile_dim_scale: int = 1,
        algorithm: BaseAlgorithm | None = None,
        **params,
    ):
        """Add an Xarray DataArray as a layer on the map.

        :param data_array: An Xarray DataArray to display on the map
        :param name: The layer's name
        :param colormap_name: A ``rio-tiler``-supported colormap name.
            See the `rio-tiler docs <https://cogeotiff.github.io/rio-tiler/latest/api/rio_tiler/colormap/#rio_tiler.colormap.ColorMaps.list>`_
            for details.
        :param colormap_range: The range of data values ``(min, max)`` to be colormapped
        :param opacity: The opacity, between 0 and 1
        :param tile_dim_scale: Tile dimension scale. Default ``1`` corresponds to 256*256px tiles
        :param algorithm: A TiTiler algorithm class.
            See the `TiTiler algorithm docs <https://developmentseed.org/titiler/examples/notebooks/Working_with_Algorithm>`_
            for details.
        """
        try:
            from jupyter_tiler.titiler import _get_server, add_data_array
        except ImportError as e:
            raise RuntimeError(
                "This method requires 'jupyter-tiler'."
                " To resolve, `pip install jupytergis[tiler]`.",
            ) from e

        self.tile_server = _get_server()
        url = await add_data_array(
            data_array,
            colormap_name=colormap_name,
            colormap_range=colormap_range,
            tile_dim_scale=tile_dim_scale,
            algorithm=algorithm,
            **params,
        )

        source_id = str(uuid4())
        source = {
            "type": SourceType.RasterSource,
            "name": f"{name} Source",
            "parameters": {
                "url": url,
                "minZoom": 0,
                "maxZoom": 24,
            },
        }
        self._add_source(OBJECT_FACTORY.create_source(source, self), id=source_id)

        layer = {
            "type": LayerType.RasterLayer,
            "name": name,
            "visible": True,
            "parameters": {"source": source_id, "opacity": opacity},
        }
        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def get_wms_available_layers(
        self,
        wms_url: str,
        version: str = "1.3.0",
        timeout: float = 30.0,
    ) -> list[dict[str, str]]:
        """Fetch a WMS GetCapabilities document and parse available top-level layers.

        Matches the behavior in the frontend WmsTileSourceUrlInput:
        - Calls: ?SERVICE=WMS&VERSION=...&REQUEST=GetCapabilities
        - Parses Capability > Layer (root Layer)
        - Returns direct child Layer elements with `Name` and `Title`.

        Returns a list of objects shaped like: { 'name': <layer name>, 'title': <layer title> }.
        """
        if not wms_url or not isinstance(wms_url, str):
            raise ValueError("wms_url must be a non-empty string")

        text = wms_url.strip()
        if not text:
            raise ValueError("wms_url must be a non-empty string")

        # Normalize to a base endpoint (remove any existing query string).
        base = text.split("?", 1)[0]
        if not base.endswith("/"):
            base += "/"

        capabilities_url = (
            f"{base}?SERVICE=WMS&VERSION={version}&REQUEST=GetCapabilities"
        )

        resp = requests.get(capabilities_url, timeout=timeout)
        resp.raise_for_status()

        xml_text = resp.text
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError as e:
            raise RuntimeError(
                f"Failed to parse WMS GetCapabilities XML from {capabilities_url}",
            ) from e

        def local_name(tag: str) -> str:
            # Handles tags like '{http://www.opengis.net/wms}Layer'
            return tag.split("}", 1)[1] if "}" in tag else tag

        service_exception = next(
            (
                el
                for el in root.iter()
                if local_name(el.tag) == "ServiceExceptionReport"
            ),
            None,
        )
        if service_exception is not None:
            msg = "".join(service_exception.itertext()).strip()
            raise RuntimeError(msg or "Failed to fetch WMS capabilities.")

        capability_el = next(
            (el for el in root.iter() if local_name(el.tag) == "Capability"),
            None,
        )
        if capability_el is None:
            return []

        root_layer_el = next(
            (child for child in capability_el if local_name(child.tag) == "Layer"),
            None,
        )
        if root_layer_el is None:
            return []

        results: list[dict[str, str]] = []
        for layer_el in list(root_layer_el):
            if local_name(layer_el.tag) != "Layer":
                continue

            name_el = next(
                (el for el in layer_el.iter() if local_name(el.tag) == "Name"),
                None,
            )
            title_el = next(
                (el for el in layer_el.iter() if local_name(el.tag) == "Title"),
                None,
            )

            name = (name_el.text or "").strip() if name_el is not None else ""
            title = (title_el.text or "").strip() if title_el is not None else ""

            if name or title:
                results.append({"name": name, "title": title})

        return results

    def add_wms_tile_layer(
        self,
        url: str,
        layer_name: str,
        name: str | None = None,
        attribution: str = "",
        opacity: float = 1,
        interpolate: bool = False,
    ) -> str:
        """Add a WMS tile layer to the document.

        url:
            Base WMS service URL (without SERVICE/REQUEST parameters), e.g.
            'https://ows.terrestris.de/osm/service'
        layer_name:
            WMS layer name to request (from GetCapabilities `Name`).
        name:
            Display name for the layer.
        attribution:
            Optional attribution text.
        opacity:
            Layer opacity in [0, 1].
        interpolate:
            Whether to interpolate between grid cells when overzooming.
        """
        if not url or not isinstance(url, str):
            raise ValueError("url must be a non-empty string")
        if not layer_name or not isinstance(layer_name, str):
            raise ValueError("layer_name must be a non-empty string")

        # Extract name from URL if not provided
        if name is None:
            name = _extract_layer_name(url)

        # Normalize: strip any existing query string since the frontend will
        # add WMS params (LAYERS/TILED) itself.
        base_url = url.strip().split("?", 1)[0]

        source = {
            "type": SourceType.WmsTileSource,
            "name": f"{name} Source",
            "parameters": {
                "url": base_url,
                "params": {
                    "layers": layer_name,
                },
                "attribution": attribution,
                "interpolate": interpolate,
            },
        }

        source_id = self._add_source(OBJECT_FACTORY.create_source(source, self))

        layer = {
            "type": LayerType.RasterLayer,
            "name": name,
            "visible": True,
            "parameters": {
                "source": source_id,
                "opacity": opacity,
                "color": {},
            },
        }

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def remove_layer(self, layer_id: str):
        """Remove a layer from the GIS document.

        :param layer_id: The ID of the layer to remove.
        :raises KeyError: If the layer does not exist.
        """
        layer = self._layers.get(layer_id)

        if layer is None:
            raise KeyError(f"No layer found with ID: {layer_id}")

        del self._layers[layer_id]
        self._remove_source_if_orphaned(layer["parameters"]["source"])

    def _remove_source_if_orphaned(self, source_id: str):
        source = self._sources.get(source_id)

        if source is None:
            raise KeyError(f"No source found with ID: {source_id}")

        source_is_orphan = not any(
            layer["parameters"]["source"] == source_id
            for layer in self._layers.values()
        )

        if source_is_orphan:
            del self._sources[source_id]

    def _add_source(self, new_object, id: str | None = None) -> str:
        self._ensure_qgis_supported(new_object.type)
        _id = str(uuid4()) if id is None else id
        obj_dict = json.loads(new_object.json())
        self._sources[_id] = obj_dict
        return _id

    def _add_layer(self, new_object, id: str | None = None) -> str:
        self._ensure_qgis_supported(new_object.type)
        _id = str(uuid4()) if id is None else id
        obj_dict = json.loads(new_object.json())
        self._ensure_symbology_qgis_supported(
            obj_dict.get("parameters", {}).get("symbologyState"),
        )
        self._layers[_id] = obj_dict
        self._layerTree.append(_id)
        return _id

    @classmethod
    def _make_comm(cls, *, path: str | None) -> dict:
        format = None
        contentType = None

        if path is not None:
            file_name = Path(path).name
            try:
                ext = file_name.split(".")[1].lower()
            except Exception as e:
                raise ValueError("Can not detect file extension!") from e

            if ext == "jgis":
                format = "text"
                contentType = "jgis"
            elif ext == "qgz":
                format = "base64"
                contentType = "QGZ"
            elif ext == "qgs":
                format = "base64"
                contentType = "QGS"
            else:
                raise ValueError("File extension is not supported!")

        return dict(
            path=path,
            format=format,
            contentType=contentType,
            create_ydoc=path is None,
        )

    def to_py(self) -> dict:
        """Get the document structure as a Python dictionary."""
        return {
            "layers": self._layers.to_py(),
            "sources": self._sources.to_py(),
            "layerTree": self._layerTree.to_py(),
            "options": self._options.to_py(),
            "metadata": self._metadata.to_py(),
        }

    def apply_symbology(self, layer_id: str, symbology: SymbologyInput):
        layer = self._layers.get(layer_id)

        if layer is None:
            raise ValueError(f"No layer found with ID: {layer_id}")

        symbology_state = to_symbology_state(symbology)
        if symbology_state is None:
            raise ValueError("Symbology cannot be None")

        self._ensure_symbology_qgis_supported(symbology_state)

        params = layer.setdefault("parameters", {})
        params["symbologyState"] = symbology_state

        # Drop legacy color expression cache — symbologyState is the source of
        # truth now, and the frontend ignores ``params.color``.
        params.pop("color", None)

        self._layers[layer_id] = layer


class JGISLayer(BaseModel):
    class Config:
        arbitrary_types_allowed = True
        extra = "allow"

    name: str
    type: LayerType
    visible: bool
    parameters: (
        IRasterLayer
        | IVectorLayer
        | IVectorTileLayer
        | IHillshadeLayer
        | IImageLayer
        | IGeoTiffLayer
        | IGeoZarrLayer
        | IStorySegmentLayer
        | IOpenEOTileLayer
    )
    _parent = GISDocument | None

    def __init__(__pydantic_self__, parent, **data: Any) -> None:  # noqa
        super().__init__(**data)
        __pydantic_self__._parent = parent


class JGISSource(BaseModel):
    class Config:
        arbitrary_types_allowed = True
        extra = "allow"

    name: str
    type: SourceType
    parameters: (
        IRasterSource
        | IVectorTileSource
        | IMarkerSource
        | IGeoJSONSource
        | IImageSource
        | IGeoTiffSource
        | IGeoZarrSource
        | IRasterDemSource
        | IGeoParquetSource
        | IGeoPackageVectorSource
        | IGeoPackageRasterSource
        | IWmsTileSource
        | IOpenEOTileSource
    )
    _parent = GISDocument | None

    def __init__(__pydantic_self__, parent, **data: Any) -> None:  # noqa
        super().__init__(**data)
        __pydantic_self__._parent = parent


class SingletonMeta(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            instance = super().__call__(*args, **kwargs)
            cls._instances[cls] = instance
        return cls._instances[cls]


class ObjectFactoryManager(metaclass=SingletonMeta):
    def __init__(self):
        self._factories: dict[str, type[BaseModel]] = {}

    def register_factory(self, shape_type: str, cls: type[BaseModel]) -> None:
        if shape_type not in self._factories:
            self._factories[shape_type] = cls

    def create_layer(
        self,
        data: dict,
        parent: GISDocument | None = None,
    ) -> JGISLayer | None:
        object_type = data.get("type")
        name: str = data.get("name")
        visible: str = data.get("visible", True)
        filters = data.get("filters")
        if object_type and object_type in self._factories:
            Model = self._factories[object_type]
            params = data["parameters"]
            # Only pass params that are present so Pydantic uses schema defaults for the rest
            args = {k: params[k] for k in Model.model_fields if k in params}
            obj_params = Model(**args)
            return JGISLayer(
                parent=parent,
                name=name,
                visible=visible,
                type=object_type,
                parameters=obj_params,
                filters=filters,
            )

        return None

    def create_source(
        self,
        data: dict,
        parent: GISDocument | None = None,
    ) -> JGISSource | None:
        object_type = data.get("type")
        name: str = data.get("name")
        if object_type and object_type in self._factories:
            Model = self._factories[object_type]
            params = data["parameters"]
            # Only pass params that are present so Pydantic uses schema defaults for the rest
            args = {k: params[k] for k in Model.model_fields if k in params}
            obj_params = Model(**args)
            return JGISSource(
                parent=parent,
                name=name,
                type=object_type,
                parameters=obj_params,
            )

        return None


OBJECT_FACTORY = ObjectFactoryManager()

OBJECT_FACTORY.register_factory(LayerType.RasterLayer, IRasterLayer)
OBJECT_FACTORY.register_factory(LayerType.VectorLayer, IVectorLayer)
OBJECT_FACTORY.register_factory(LayerType.VectorTileLayer, IVectorTileLayer)
OBJECT_FACTORY.register_factory(LayerType.HillshadeLayer, IHillshadeLayer)
OBJECT_FACTORY.register_factory(LayerType.GeoTiffLayer, IGeoTiffLayer)
OBJECT_FACTORY.register_factory(LayerType.GeoZarrLayer, IGeoZarrLayer)
OBJECT_FACTORY.register_factory(LayerType.ImageLayer, IImageLayer)
OBJECT_FACTORY.register_factory(LayerType.StorySegmentLayer, IStorySegmentLayer)
OBJECT_FACTORY.register_factory(LayerType.OpenEOTileLayer, IOpenEOTileLayer)

OBJECT_FACTORY.register_factory(SourceType.VectorTileSource, IVectorTileSource)
OBJECT_FACTORY.register_factory(SourceType.MarkerSource, IMarkerSource)
OBJECT_FACTORY.register_factory(SourceType.RasterSource, IRasterSource)
OBJECT_FACTORY.register_factory(SourceType.GeoJSONSource, IGeoJSONSource)
OBJECT_FACTORY.register_factory(SourceType.ImageSource, IImageSource)
OBJECT_FACTORY.register_factory(SourceType.GeoTiffSource, IGeoTiffSource)
OBJECT_FACTORY.register_factory(SourceType.GeoZarrSource, IGeoZarrSource)
OBJECT_FACTORY.register_factory(SourceType.RasterDemSource, IRasterDemSource)
OBJECT_FACTORY.register_factory(SourceType.GeoParquetSource, IGeoParquetSource)
OBJECT_FACTORY.register_factory(
    SourceType.GeoPackageVectorSource,
    IGeoPackageVectorSource,
)
OBJECT_FACTORY.register_factory(
    SourceType.GeoPackageRasterSource,
    IGeoPackageRasterSource,
)
OBJECT_FACTORY.register_factory(SourceType.WmsTileSource, IWmsTileSource)
OBJECT_FACTORY.register_factory(SourceType.OpenEOTileSource, IOpenEOTileSource)
