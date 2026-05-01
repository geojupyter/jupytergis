from __future__ import annotations

import json
import logging
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Literal, Optional
from uuid import uuid4

import requests
from IPython.display import display
from jupytergis_core.colors import try_hex_to_rgba
from jupytergis_core.schema import (
    IGeoJSONSource,
    IGeoPackageRasterSource,
    IGeoPackageVectorSource,
    IGeoParquetSource,
    IGeoTiffLayer,
    IGeoTiffSource,
    IHeatmapLayer,
    IHillshadeLayer,
    IImageLayer,
    IImageSource,
    IMarkerSource,
    IRasterDemSource,
    IRasterLayer,
    IRasterSource,
    IStorySegmentLayer,
    IVectorLayer,
    IVectorTileLayer,
    IVectorTileSource,
    IVideoSource,
    IWmsTileSource,
    LayerType,
    SourceType,
)
from pycrdt import Array, Map
from pydantic import BaseModel
from sidecar import Sidecar
from ypywidgets.comm import CommWidget

from jupytergis_lab.notebook.utils import get_gpkg_layers

logger = logging.getLogger(__file__)


def reversed_tree(root):
    if isinstance(root, list):
        return reversed([reversed_tree(el) for el in root])
    return root


def _color_to_rgba(value: Any) -> list[float] | None:
    """Coerce an OL-flavored color value (hex string or [r, g, b, a] array)
    into an ``[r, g, b, a]`` list. Returns ``None`` if ``value`` is an OL
    expression (e.g. ``["interpolate", ...]``) or otherwise unparseable.
    """
    if isinstance(value, str):
        rgba = try_hex_to_rgba(value)
        return list(rgba) if rgba else None
    if (
        isinstance(value, (list, tuple))
        and value
        and isinstance(value[0], (int, float))
    ):
        rgba = list(value) + [1.0] * (4 - len(value))
        return [float(c) for c in rgba[:4]]
    return None


# NOTE: Kept intentionally minimal and aligned with the frontend migration in
# ``symbologyMigration.ts`` — the only mandatory field is ``renderType``. Other
# defaults (``method``, ``colorRamp``, ``nClasses``, ``mode``) live in the
# schema (``packages/schema/src/schema/project/layers/vectorLayer.json``) and
# are applied by the schema consumer on the frontend. Duplicating them here
# would create a drift risk if the schema defaults ever change.
def _vector_symbology_state_from_color_expr(color_expr: Any) -> dict[str, Any]:
    """Translate a legacy ``color_expr`` dict (OpenLayers FlatStyle keys such as
    ``fill-color``, ``stroke-color``, ``circle-radius``) into a ``symbologyState``
    dict that satisfies the schema. Expression values that aren't solid colors
    are ignored — those require richer Single Symbol configuration that the
    Python API doesn't yet surface.
    """
    state: dict[str, Any] = {"renderType": "Single Symbol"}

    if not isinstance(color_expr, dict):
        return state

    fill = _color_to_rgba(
        color_expr.get("fill-color") or color_expr.get("circle-fill-color"),
    )
    if fill is not None:
        state["fillColor"] = fill

    stroke = _color_to_rgba(
        color_expr.get("stroke-color") or color_expr.get("circle-stroke-color"),
    )
    if stroke is not None:
        state["strokeColor"] = stroke

    stroke_width = color_expr.get("stroke-width") or color_expr.get(
        "circle-stroke-width",
    )
    if isinstance(stroke_width, (int, float)):
        state["strokeWidth"] = stroke_width

    radius = color_expr.get("circle-radius")
    if isinstance(radius, (int, float)):
        state["radius"] = radius

    if "circle-fill-color" in color_expr or "circle-radius" in color_expr:
        state["geometryType"] = "circle"
    elif "fill-color" in color_expr:
        state["geometryType"] = "fill"
    elif "stroke-color" in color_expr or "stroke-width" in color_expr:
        state["geometryType"] = "line"

    return state


class GISDocument(CommWidget):
    """Create a new GISDocument object.

    :param path: the path to the file that you would like to open. If not provided, a new ephemeral widget will be created.

    Collaborative client state from the front end is mirrored into :mod:`ypywidgets`
    ``Awareness`` on the kernel. Subscribe with ``on_awareness_change(callback)``
    (returns a subscription id; use ``unobserve_awareness(id)`` to remove). The
    current snapshot is available as ``awareness.states`` on the underlying
    ``pycrdt.Awareness`` via the inherited ``awareness`` property.
    """

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
                "storyMapPresentationMode": False,
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

    @property
    def layers(self) -> dict:
        """Get the layer list"""
        return self._layers.to_py()

    @property
    def layer_tree(self) -> list[str | dict]:
        """Get the layer tree"""
        return self._layerTree.to_py()

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
        name: str = "Raster Layer",
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
        name: str = "Vector Tile Layer",
        attribution: str = "",
        min_zoom: int = 0,
        max_zoom: int = 24,
        color_expr=None,
        opacity: float = 1,
        logical_op: str | None = None,
        feature: str | None = None,
        operator: str | None = None,
        value: str | float | None = None,
    ):
        """Add a Vector Tile Layer to the document.

        :param name: The name that will be used for the object in the document.
        :param url: The tiles url.
        :param attribution: The attribution.
        :param opacity: The opacity, between 0 and 1.
        """
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
                "symbologyState": _vector_symbology_state_from_color_expr(color_expr),
            },
            "filters": {
                "appliedFilters": [
                    {"feature": feature, "operator": operator, "value": value},
                ],
                "logicalOp": logical_op,
            },
        }

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_geojson_layer(
        self,
        path: str | Path | None = None,
        data: dict | None = None,
        name: str = "GeoJSON Layer",
        opacity: float = 1,
        logical_op: str | None = None,
        feature: str | None = None,
        operator: str | None = None,
        value: str | float | None = None,
        color_expr=None,
    ):
        """Add a GeoJSON Layer to the document.

        :param name: The name that will be used for the object in the document.
        :param path: The path to the JSON file or URL to embed into the jGIS file.
        :param data: The raw GeoJSON data to embed into the jGIS file.
        :param opacity: The opacity, between 0 and 1.
        :param color_expr: The style expression used to style the layer, defaults to None
        """
        if isinstance(path, Path):
            path = str(path)

        if path is None and data is None:
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

        if color_expr is None:
            color_expr = {}

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
                "symbologyState": _vector_symbology_state_from_color_expr(color_expr),
            },
            "filters": {
                "appliedFilters": [
                    {"feature": feature, "operator": operator, "value": value},
                ],
                "logicalOp": logical_op,
            },
        }

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_image_layer(
        self,
        url: str,
        coordinates: [],
        name: str = "Image Layer",
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

    def add_video_layer(
        self,
        urls: list,
        name: str = "Image Layer",
        coordinates: list | None = None,
        opacity: float = 1,
    ):
        """Add a Video Layer to the document.

        :param name: The name that will be used for the object in the document.
        :param urls: URLs to video content in order of preferred format.
        :param coordinates: Corners of video specified in longitude, latitude pairs.
        :param opacity: The opacity, between 0 and 1.
        """
        if coordinates is None:
            coordinates = []

        if urls is None or coordinates is None:
            raise ValueError("URLs and Coordinates are required")

        source = {
            "type": SourceType.VideoSource,
            "name": f"{name} Source",
            "parameters": {"urls": urls, "coordinates": coordinates},
        }

        source_id = self._add_source(OBJECT_FACTORY.create_source(source, self))

        layer = {
            "type": LayerType.RasterLayer,
            "name": name,
            "visible": True,
            "parameters": {"source": source_id, "opacity": opacity},
        }

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_tiff_layer(
        self,
        url: str,
        min: int = None,
        max: int = None,
        name: str = "Tiff Layer",
        normalize: bool = True,
        wrapX: bool = False,
        attribution: str = "",
        opacity: float = 1.0,
        color_expr=None,
    ):
        """Add a tiff layer

        :param url: URL of the tif
        :param min: Minimum pixel value to be displayed, defaults to letting the map display set the value
        :param max: Maximum pixel value to be displayed, defaults to letting the map display set the value
        :param name: The name that will be used for the object in the document, defaults to "Tiff Layer"
        :param normalize: Select whether to normalize values between 0..1, if false than min/max have no effect, defaults to True
        :param wrapX: Render tiles beyond the tile grid extent, defaults to False
        :param opacity: The opacity, between 0 and 1, defaults to 1.0
        :param color_expr: The style expression used to style the layer, defaults to None
        """
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
                "color": color_expr,
            },
        }

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_hillshade_layer(
        self,
        url: str,
        name: str = "Hillshade Layer",
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

    def add_heatmap_layer(
        self,
        feature: str,
        path: str | Path | None = None,
        data: dict | None = None,
        name: str = "Heatmap Layer",
        opacity: float = 1,
        blur: int = 15,
        radius: int = 8,
        gradient: list[str] | None = None,
    ):
        """Add a Heatmap Layer to the document.

        :param name: The name that will be used for the object in the document.
        :param path: The path to the JSON file to embed into the jGIS file.
        :param data: The raw GeoJSON data to embed into the jGIS file.
        :param gradient: The color gradient to apply.
        :param opacity: The opacity, between 0 and 1.
        :param blur: The blur size in pixels
        :param radius: The radius size in pixels
        :param feature: The feature to use to heatmap weights
        """
        if isinstance(path, Path):
            path = str(path)

        if path is None and data is None:
            raise ValueError("Cannot create a GeoJSON source without data")

        if path is not None and data is not None:
            raise ValueError("Cannot set GeoJSON source data and path at the same time")

        if path is not None:
            # We cannot put the path to the file in the model
            # We don't know where the kernel runs/live
            # The front-end would have no way of finding the file reliably
            # TODO Support urls to JSON files, in that case, don't embed the data
            with open(path) as fobj:
                parameters = {"data": json.loads(fobj.read())}

        if data is not None:
            parameters = {"data": data}

        if gradient is None:
            gradient = ["#00f", "#0ff", "#0f0", "#ff0", "#f00"]

        source = {
            "type": SourceType.GeoJSONSource,
            "name": f"{name} Source",
            "parameters": parameters,
        }

        source_id = self._add_source(OBJECT_FACTORY.create_source(source, self))

        layer = {
            "type": LayerType.HeatmapLayer,
            "name": name,
            "visible": True,
            "parameters": {
                "source": source_id,
                "opacity": opacity,
                "blur": blur,
                "radius": radius,
                "feature": feature,
                "symbologyState": {
                    "renderType": "Heatmap",
                    "gradient": gradient,
                },
            },
        }

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_geoparquet_layer(
        self,
        path: str,
        name: str = "GeoParquetLayer",
        opacity: float = 1,
        logical_op: str | None = None,
        feature: str | None = None,
        operator: str | None = None,
        value: str | float | None = None,
        color_expr=None,
    ):
        """Add a GeoParquet Layer to the document

        :param path: The path to the GeoParquet file to embed into the jGIS file.
        :param name: The name that will be used for the object in the document.
        :param opacity: The opacity, between 0 and 1.
        :param logical_op: The logical combination to apply to filters. Must be "any" or "all"
        :param feature: The feature to be filtered on
        :param operator: The operator used to compare the feature and value
        :param value: The value to be filtered on
        :param color_expr: The style expression used to style the layer
        """
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
                "symbologyState": _vector_symbology_state_from_color_expr(color_expr),
            },
            "filters": {
                "appliedFilters": [
                    {"feature": feature, "operator": operator, "value": value},
                ],
                "logicalOp": logical_op,
            },
        }

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_geopackage_vector_layer(
        self,
        path: str,
        table_names: list[str] | str | None = None,
        name: str = "GeoPackage Layer",
        type: Literal["circle", "fill", "line"] = "line",
        opacity: float = 1,
        logical_op: str | None = None,
        feature: str | None = None,
        operator: str | None = None,
        value: str | float | None = None,
        color_expr=None,
    ):
        """Add a GeoPackage Vector Layer to the document

        :param path: The path to the GeoPackage file to embed into the jGIS file.
        :param table_names: A list of table names to create layers for.
        :param name: The name that will be used for the object in the document.
        :param type: The type of the vector layer to create.
        :param opacity: The opacity, between 0 and 1.
        :param logical_op: The logical combination to apply to filters. Must be "any" or "all"
        :param feature: The feature to be filtered on
        :param operator: The operator used to compare the feature and value
        :param value: The value to be filtered on
        :param color_expr: The style expression used to style the layer
        """
        if isinstance(table_names, str):
            table_names = [part.strip() for part in table_names.split(",")]

        if not table_names:
            table_names = get_gpkg_layers(path, "features")

        layer_ids = []

        if "projection" in self._options:
            projection = self._options["projection"]
        else:
            projection = "EPSG:3857"

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
                    "symbologyState": _vector_symbology_state_from_color_expr(
                        color_expr,
                    ),
                },
                "filters": {
                    "appliedFilters": [
                        {"feature": feature, "operator": operator, "value": value},
                    ],
                    "logicalOp": logical_op,
                },
            }

            layer_id = str(uuid4()) + "/" + str(table_name)
            layer_ids.append(
                self._add_layer(OBJECT_FACTORY.create_layer(layer, self), layer_id),
            )

        return layer_ids

    def add_geopackage_raster_layer(
        self,
        path: str,
        table_names: list[str] | str | None = None,
        name: str = "GeoPackage Layer",
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
                    "type": type,
                    "opacity": opacity,
                    "attribution": attribution,
                },
            }

            layer_id = str(uuid4()) + "/" + str(table_name)
            layer_ids.append(
                self._add_layer(OBJECT_FACTORY.create_layer(layer, self), layer_id),
            )

        return layer_ids

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
        name: str = "WMS Layer",
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

    def create_color_expr(
        self,
        color_stops: dict,
        band: float = 1.0,
        interpolation_type: str = "linear",
    ):
        """Create a color expression used to style the layer

        :param color_stops: Dictionary of stop values to [r, g, b, a] colors
        :param band: The band to be colored, defaults to 1.0
        :param interpolation_type: The interpolation function. Can be linear, discrete, or exact, defaults to 'linear'
        """
        if interpolation_type not in ["linear", "discrete", "exact"]:
            raise ValueError(
                "Interpolation type must be one of linear, discrete, or exact",
            )

        color = []
        if interpolation_type == "linear":
            color = ["interpolate", ["linear"]]
            color.append(["band", band])
            # Transparency for nodata
            color.append(0.0)
            color.append([0.0, 0.0, 0.0, 0.0])

            for value, colorVal in color_stops.items():
                color.append(value)
                color.append(colorVal)

            return color

        if interpolation_type == "discrete":
            operator = "<="

        if interpolation_type == "exact":
            operator = "=="

        color = ["case"]
        # Transparency for nodata
        color.append(["==", ["band", band], 0.0])
        color.append([0.0, 0.0, 0.0, 0.0])

        for value, colorVal in color_stops.items():
            color.append([operator, ["band", band], value])
            color.append(colorVal)

        # Fallback color
        color.append([0.0, 0.0, 0.0, 1.0])

        return color

    def add_filter(
        self,
        layer_id: str,
        logical_op: str,
        feature: str,
        operator: str,
        value: str | float,
    ):
        """Add a filter to a layer

        :param layer_id: The ID of the layer to filter
        :param logical_op: The logical combination to apply to filters. Must be "any" or "all"
        :param feature: The feature to be filtered on
        :param operator: The operator used to compare the feature and value
        :param value: The value to be filtered on
        """
        layer = self._layers.get(layer_id)

        # Check if the layer exists
        if layer is None:
            raise ValueError(f"No layer found with ID: {layer_id}")

        # Initialize filters if it doesn't exist
        if "filters" not in layer:
            layer["filters"] = {
                "appliedFilters": [
                    {"feature": feature, "operator": operator, "value": value},
                ],
                "logicalOp": logical_op,
            }

            self._layers[layer_id] = layer
            return

        # Add new filter
        filters = layer["filters"]
        filters["appliedFilters"].append(
            {"feature": feature, "operator": operator, "value": value},
        )

        # update the logical operation
        filters["logicalOp"] = logical_op

        self._layers[layer_id] = layer

    def update_filter(
        self,
        layer_id: str,
        logical_op: str,
        feature: str,
        operator: str,
        value: str | float,
    ):
        """Update a filter applied to a layer

        :param layer_id: The ID of the layer to filter
        :param logical_op: The logical combination to apply to filters. Must be "any" or "all"
        :param feature: The feature to update the value for
        :param operator: The operator used to compare the feature and value
        :param value: The new value to be filtered on
        """
        layer = self._layers.get(layer_id)

        # Check if the layer exists
        if layer is None:
            raise ValueError(f"No layer found with ID: {layer_id}")

        if "filters" not in layer:
            raise ValueError(f"No filters applied to layer: {layer_id}")

        # Find the feature within the layer
        feature = next(
            (f for f in layer["filters"]["appliedFilters"] if f["feature"] == feature),
            None,
        )
        if feature is None:
            raise ValueError(
                f"No feature found with ID: {feature} in layer: {layer_id}",
            )
            return

        # Update the feature value
        feature["value"] = value

        # update the logical operation
        layer["filters"]["logicalOp"] = logical_op

        self._layers[layer_id] = layer

    def clear_filters(self, layer_id: str):
        """Clear filters on a layer

        :param layer_id: The ID of the layer to clear filters from
        """
        layer = self._layers.get(layer_id)

        # Check if the layer exists
        if layer is None:
            raise ValueError(f"No layer found with ID: {layer_id}")

        if "filters" not in layer:
            raise ValueError(f"No filters applied to layer: {layer_id}")

        layer["filters"]["appliedFilters"] = []
        self._layers[layer_id] = layer

    def _add_source(self, new_object, id: str | None = None) -> str:
        _id = str(uuid4()) if id is None else id
        obj_dict = json.loads(new_object.json())
        self._sources[_id] = obj_dict
        return _id

    def _add_layer(self, new_object, id: str | None = None) -> str:
        _id = str(uuid4()) if id is None else id
        obj_dict = json.loads(new_object.json())
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
        | IHeatmapLayer
        | IStorySegmentLayer
    )
    _parent = Optional[GISDocument]

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
        | IVideoSource
        | IGeoTiffSource
        | IRasterDemSource
        | IGeoParquetSource
        | IGeoPackageVectorSource
        | IGeoPackageRasterSource
        | IWmsTileSource
    )
    _parent = Optional[GISDocument]

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
OBJECT_FACTORY.register_factory(LayerType.ImageLayer, IImageLayer)
OBJECT_FACTORY.register_factory(LayerType.HeatmapLayer, IHeatmapLayer)
OBJECT_FACTORY.register_factory(LayerType.StorySegmentLayer, IStorySegmentLayer)

OBJECT_FACTORY.register_factory(SourceType.VectorTileSource, IVectorTileSource)
OBJECT_FACTORY.register_factory(SourceType.MarkerSource, IMarkerSource)
OBJECT_FACTORY.register_factory(SourceType.RasterSource, IRasterSource)
OBJECT_FACTORY.register_factory(SourceType.GeoJSONSource, IGeoJSONSource)
OBJECT_FACTORY.register_factory(SourceType.ImageSource, IImageSource)
OBJECT_FACTORY.register_factory(SourceType.VideoSource, IVideoSource)
OBJECT_FACTORY.register_factory(SourceType.GeoTiffSource, IGeoTiffSource)
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
