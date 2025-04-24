from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Optional

from jupytergis_lab import GISDocument


@dataclass
class Basemap:
    name: str
    url: str


BasemapChoice = Literal["light", "dark", "topo"]
_basemaps: dict[BasemapChoice, list[Basemap]] = {
    "light": [
        Basemap(
            name="ArcGIS dark basemap",
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}.pbf",
        ),
        Basemap(
            name="ArcGIS dark basemap reference",
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}.pbf",
        ),
    ],
    "dark": [
        Basemap(
            name="ArcGIS light basemap",
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}.pbf",
        ),
        Basemap(
            name="ArcGIS light basemap reference",
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

    doc.add_layer(data, name=layer_name)

    # TODO: Zoom to layer. Currently not exposed in Python API.

    doc.sidecar(title="JupyterGIS explorer")

    # TODO: should we return `doc`? It enables the exploration environment more usable,
    # but by default, `explore(...)` would display a widget in the notebook _and_ open a
    # sidecar for the same widget. The user would need to append a semicolon to disable
    # that behavior. We can't disable that behavior from within this function to the
    # best of my knowlwedge.
