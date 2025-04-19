from pathlib import Path
from typing import Any, Literal
import re

from jupytergis_lab import GISDocument


def explore(data: str | Path | Any) -> GISDocument:
    """Run a JupyterGIS data interaction interface alongside a Notebook.

    :param data: A GeoDataFrame or path to a GeoJSON file.

    :raises FileNotFoundException: User passed a file that isn't present.
    :raises NotImplementedError: User passed an input value that isn't supported yet.
    :raises TypeError: User passed an object type that isn't supported.
    :raises ValueError: User passed an object value that isn't supported.
    """
    doc = GISDocument()

    # TODO: Basic basemap choices, e.g. add parameter `basemap: Literal["dark", "light"]`
    doc.add_raster_layer(
        "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}"
    )

    # TODO: Extract to GISDocument class
    _add_layer(doc, data)

    # TODO: Zoom to layer. Currently not exposed in Python API.

    doc.sidecar(title="JupyterGIS explorer")

    # TODO: should we return `doc`? It enables the exploration environment more usable,
    # but by default, `explore(...)` would display a widget in the notebook _and_ open a
    # sidecar for the same widget. The user would need to append a semicolon to disable
    # that behavior. We can't disable that behavior from within this function to the
    # best of my knowlwedge.


def _add_layer(doc: GISDocument, data: str | Path | Any) -> None:
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
            doc.add_geojson_layer(path=data)
            return
        # TODO: elif ext in ['.tif', '.tiff']:
        else:
            raise ValueError(f"Unknown file type: {data}")

    try:
        from geopandas import GeoDataFrame

        if isinstance(data, GeoDataFrame):
            print(type(data.to_geo_dict()))
            doc.add_geojson_layer(data=data.to_geo_dict())
            return
    except ImportError:
        pass

    raise TypeError(f"Unsupported input type: {type(data)}")
