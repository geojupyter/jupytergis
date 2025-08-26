from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Union
from uuid import uuid4
import requests

from pycrdt import Array, Map
from pydantic import BaseModel
from sidecar import Sidecar
from ypywidgets.comm import CommWidget

from jupytergis_core.schema import (
    IGeoJSONSource,
    IGeoParquetSource,
    IGeoTiffSource,
    IHeatmapLayer,
    IHillshadeLayer,
    IImageLayer,
    IImageSource,
    IRasterDemSource,
    IRasterLayer,
    IRasterSource,
    IVectorLayer,
    IVectorTileLayer,
    IVectorTileSource,
    IVideoSource,
    IWebGlLayer,
    LayerType,
    SourceType,
)

logger = logging.getLogger(__file__)


def reversed_tree(root):
    if isinstance(root, list):
        return reversed([reversed_tree(el) for el in root])
    return root


class GISDocument(CommWidget):
    """
    Create a new GISDocument object.

    :param path: the path to the file that you would like to open. If not provided, a new ephemeral widget will be created.
    """

    def __init__(
        self,
        path: Optional[str | Path] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        zoom: Optional[float] = None,
        extent: Optional[List[float]] = None,
        bearing: Optional[float] = None,
        pitch: Optional[float] = None,
        projection: Optional[str] = None,
    ):
        if isinstance(path, Path):
            path = str(path)

        super().__init__(
            comm_metadata={
                "ymodel_name": "@jupytergis:widget",
                **self._make_comm(path=path),
            }
        )

        self.ydoc["layers"] = self._layers = Map()
        self.ydoc["sources"] = self._sources = Map()
        self.ydoc["options"] = self._options = Map()
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
    def layers(self) -> Dict:
        """
        Get the layer list
        """
        return self._layers.to_py()

    @property
    def layer_tree(self) -> List[str | Dict]:
        """
        Get the layer tree
        """
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
    ):
        """
        Add a Raster Layer to the document.

        :param name: The name that will be used for the object in the document.
        :param url: The tiles url.
        :param attribution: The attribution.
        :param opacity: The opacity, between 0 and 1.
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
                "urlParameters": {},
            },
        }

        source_id = self._add_source(OBJECT_FACTORY.create_source(source, self))

        layer = {
            "type": LayerType.RasterLayer,
            "name": name,
            "visible": True,
            "parameters": {"source": source_id, "opacity": opacity},
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
        value: Union[str, float, float] | None = None,
    ):
        """
        Add a Vector Tile Layer to the document.

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
                "color": color_expr,
                "opacity": opacity,
            },
            "filters": {
                "appliedFilters": [
                    {"feature": feature, "operator": operator, "value": value}
                ],
                "logicalOp": logical_op,
            },
        }

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_geojson_layer(
        self,
        path: str | Path | None = None,
        data: Dict | None = None,
        name: str = "GeoJSON Layer",
        opacity: float = 1,
        logical_op: str | None = None,
        feature: str | None = None,
        operator: str | None = None,
        value: Union[str, int, float] | None = None,
        color_expr=None,
    ):
        """
        Add a GeoJSON Layer to the document.

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
                with open(path, "r") as fobj:
                    parameters["data"] = json.load(fobj)

        if data is not None:
            parameters["data"] = data

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
                "color": color_expr,
                "opacity": opacity,
            },
            "filters": {
                "appliedFilters": [
                    {"feature": feature, "operator": operator, "value": value}
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
        """
        Add a Image Layer to the document.

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
        urls: List,
        name: str = "Image Layer",
        coordinates: Optional[List] = None,
        opacity: float = 1,
    ):
        """
        Add a Video Layer to the document.

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
        """
        Add a tiff layer

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
            "type": LayerType.WebGlLayer,
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
        urlParameters: Optional[Dict] = None,
        attribution: str = "",
    ):
        """
        Add a hillshade layer

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
        data: Dict | None = None,
        name: str = "Heatmap Layer",
        opacity: float = 1,
        blur: int = 15,
        radius: int = 8,
        gradient: Optional[List[str]] = None,
    ):
        """
        Add a Heatmap Layer to the document.

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
            with open(path, "r") as fobj:
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
                "type": type,
                "color": gradient,
                "opacity": opacity,
                "blur": blur,
                "radius": radius,
                "feature": feature,
            },
        }

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def add_geoparquet_layer(
        self,
        path: str,
        name: str = "GeoParquetLayer",
        type: "circle" | "fill" | "line" = "line",
        opacity: float = 1,
        logical_op: str | None = None,
        feature: str | None = None,
        operator: str | None = None,
        value: Union[str, int, float] | None = None,
        color_expr=None,
    ):
        """
        Add a GeoParquet Layer to the document

        :param path: The path to the GeoParquet file to embed into the jGIS file.
        :param name: The name that will be used for the object in the document.
        :param type: The type of the vector layer to create.
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
                "type": type,
                "opacity": opacity,
                "color": color_expr,
            },
            "filters": {
                "appliedFilters": [
                    {"feature": feature, "operator": operator, "value": value}
                ],
                "logicalOp": logical_op,
            },
        }

        return self._add_layer(OBJECT_FACTORY.create_layer(layer, self))

    def remove_layer(self, layer_id: str):
        """
        Remove a layer from the GIS document.

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
        color_stops: Dict,
        band: float = 1.0,
        interpolation_type: str = "linear",
    ):
        """
        Create a color expression used to style the layer

        :param color_stops: Dictionary of stop values to [r, g, b, a] colors
        :param band: The band to be colored, defaults to 1.0
        :param interpolation_type: The interpolation function. Can be linear, discrete, or exact, defaults to 'linear'
        """

        if interpolation_type not in ["linear", "discrete", "exact"]:
            raise ValueError(
                "Interpolation type must be one of linear, discrete, or exact"
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
        value: Union[str, int, float],
    ):
        """
        Add a filter to a layer

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
                    {"feature": feature, "operator": operator, "value": value}
                ],
                "logicalOp": logical_op,
            }

            self._layers[layer_id] = layer
            return

        # Add new filter
        filters = layer["filters"]
        filters["appliedFilters"].append(
            {"feature": feature, "operator": operator, "value": value}
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
        value: Union[str, int, float],
    ):
        """
        Update a filter applied to a layer

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
                f"No feature found with ID: {feature} in layer: {layer_id}"
            )
            return

        # Update the feature value
        feature["value"] = value

        # update the logical operation
        layer["filters"]["logicalOp"] = logical_op

        self._layers[layer_id] = layer

    def clear_filters(self, layer_id: str):
        """
        Clear filters on a layer

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

    def _add_source(self, new_object: "JGISObject", id: str | None = None) -> str:
        _id = str(uuid4()) if id is None else id
        obj_dict = json.loads(new_object.json())
        self._sources[_id] = obj_dict
        return _id

    def _add_layer(self, new_object: "JGISObject") -> str:
        _id = str(uuid4())
        obj_dict = json.loads(new_object.json())
        self._layers[_id] = obj_dict
        self._layerTree.append(_id)
        return _id

    @classmethod
    def _make_comm(cls, *, path: Optional[str]) -> Dict:
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
    parameters: Union[
        IRasterLayer,
        IVectorLayer,
        IVectorTileLayer,
        IHillshadeLayer,
        IImageLayer,
        IWebGlLayer,
        IHeatmapLayer,
    ]
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
    parameters: Union[
        IRasterSource,
        IVectorTileSource,
        IGeoJSONSource,
        IImageSource,
        IVideoSource,
        IGeoTiffSource,
        IRasterDemSource,
        IGeoParquetSource,
    ]
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
        self._factories: Dict[str, type[BaseModel]] = {}

    def register_factory(self, shape_type: str, cls: type[BaseModel]) -> None:
        if shape_type not in self._factories:
            self._factories[shape_type] = cls

    def create_layer(
        self, data: Dict, parent: Optional[GISDocument] = None
    ) -> Optional[JGISLayer]:
        object_type = data.get("type", None)
        name: str = data.get("name", None)
        visible: str = data.get("visible", True)
        filters = data.get("filters", None)
        if object_type and object_type in self._factories:
            Model = self._factories[object_type]
            args = {}
            params = data["parameters"]
            for field in Model.__fields__:
                args[field] = params.get(field, None)
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
        self, data: Dict, parent: Optional[GISDocument] = None
    ) -> Optional[JGISSource]:
        object_type = data.get("type", None)
        name: str = data.get("name", None)
        if object_type and object_type in self._factories:
            Model = self._factories[object_type]
            args = {}
            params = data["parameters"]
            for field in Model.__fields__:
                args[field] = params.get(field, None)
            obj_params = Model(**args)
            return JGISSource(
                parent=parent, name=name, type=object_type, parameters=obj_params
            )

        return None


OBJECT_FACTORY = ObjectFactoryManager()

OBJECT_FACTORY.register_factory(LayerType.RasterLayer, IRasterLayer)
OBJECT_FACTORY.register_factory(LayerType.VectorLayer, IVectorLayer)
OBJECT_FACTORY.register_factory(LayerType.VectorTileLayer, IVectorTileLayer)
OBJECT_FACTORY.register_factory(LayerType.HillshadeLayer, IHillshadeLayer)
OBJECT_FACTORY.register_factory(LayerType.WebGlLayer, IWebGlLayer)
OBJECT_FACTORY.register_factory(LayerType.ImageLayer, IImageLayer)
OBJECT_FACTORY.register_factory(LayerType.HeatmapLayer, IHeatmapLayer)

OBJECT_FACTORY.register_factory(SourceType.VectorTileSource, IVectorTileSource)
OBJECT_FACTORY.register_factory(SourceType.RasterSource, IRasterSource)
OBJECT_FACTORY.register_factory(SourceType.GeoJSONSource, IGeoJSONSource)
OBJECT_FACTORY.register_factory(SourceType.ImageSource, IImageSource)
OBJECT_FACTORY.register_factory(SourceType.VideoSource, IVideoSource)
OBJECT_FACTORY.register_factory(SourceType.GeoTiffSource, IGeoTiffSource)
OBJECT_FACTORY.register_factory(SourceType.RasterDemSource, IRasterDemSource)
OBJECT_FACTORY.register_factory(SourceType.GeoParquetSource, IGeoParquetSource)
