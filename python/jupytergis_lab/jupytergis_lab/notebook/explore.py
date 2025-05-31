from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Optional
import re

from jupytergis_lab import GISDocument


@dataclass
class Basemap:
    name: str
    url: str


BasemapChoice = Literal["light", "dark", "topo"]
_basemaps: dict[BasemapChoice, list[Basemap]] = {
    "light": [
        Basemap(
            name="ArcGIS light basemap",
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}.pbf",
        ),
        Basemap(
            name="ArcGIS light basemap reference",
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}.pbf",
        ),
    ],
    "dark": [
        Basemap(
            name="ArcGIS dark basemap",
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}.pbf",
        ),
        Basemap(
            name="ArcGIS dark basemap reference",
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}.pbf",
        ),
    ],
    "topo": [
        Basemap(
            name="USGS topographic basemap",
            url="https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
        ),
    ],
}


def explore(
    data: str | Path | Any,
    *,
    layer_name: Optional[str] = "Exploration layer",
    basemap: BasemapChoice = "topo",
) -> GISDocument:
    """Run a JupyterGIS data interaction interface alongside a Notebook.

    :param data: A GeoDataFrame or path to a GeoJSON file.

    :raises FileNotFoundError: Received a file path that doesn't exist.
    :raises NotImplementedError: Received an input value that isn't supported yet.
    :raises TypeError: Received an object type that isn't supported.
    :raises ValueError: Received an input value that isn't supported.
    """
    doc = GISDocument()

    for basemap_obj in _basemaps[basemap]:
        doc.add_raster_layer(basemap_obj.url, name=basemap_obj.name)

    _add_layer(doc=doc, data=data, name=layer_name)

    # TODO: Zoom to layer. Currently not exposed in Python API.

    doc.sidecar(title="JupyterGIS explorer")

    # TODO: should we return `doc`? It enables the exploration environment more usable,
    # but by default, `explore(...)` would display a widget in the notebook _and_ open a
    # sidecar for the same widget. The user would need to append a semicolon to disable
    # that behavior. We can't disable that behavior from within this function to the
    # best of my knowlwedge.


def _add_layer(
    *,
    doc: GISDocument,
    data: Any,
    name: str,
) -> str:
    """Add a layer to the document, autodetecting its type.

    This method currently supports only GeoDataFrames and GeoJSON files.

    :param doc: A GISDocument to add the layer to.
    :param data: A data object. Valid data objects include geopandas GeoDataFrames and paths to GeoJSON files.
    :param name: The name that will be used for the layer.

    :return: A layer ID string.

    :raises FileNotFoundError: Received a file path that doesn't exist.
    :raises NotImplementedError: Received an input value that isn't supported yet.
    :raises TypeError: Received an object type that isn't supported.
    :raises ValueError: Received an input value that isn't supported.
    """
    if isinstance(data, str):
        if re.match(r"^(http|https)://", data) is not None:
            raise NotImplementedError("URLs not yet supported.")
        else:
            data = Path(data)

    if isinstance(data, Path):
        if not data.exists():
            raise FileNotFoundError(f"File not found: {data}")

        ext = data.suffix.lower()

        if ext in [".geojson", ".json"]:
            return doc.add_geojson_layer(path=data, name=name)
        elif ext in [".tif", ".tiff"]:
            raise NotImplementedError("GeoTIFFs not yet supported.")
        else:
            raise ValueError(f"Unsupported file type: {data}")

    try:
        from geopandas import GeoDataFrame

        if isinstance(data, GeoDataFrame):
            return doc.add_geojson_layer(data=data.to_geo_dict(), name=name)
    except ImportError:
        pass

    raise TypeError(f"Unsupported input type: {type(data)}")
