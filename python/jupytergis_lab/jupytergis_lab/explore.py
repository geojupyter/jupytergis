from pathlib import Path
from typing import Any, Optional

from jupytergis_lab import GISDocument


def explore(
    data: str | Path | Any,
    *,
    layer_name: Optional[str] = None,
) -> GISDocument:
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

    doc.add_layer(data, name=layer_name)

    # TODO: Zoom to layer. Currently not exposed in Python API.

    doc.sidecar(title="JupyterGIS explorer")

    # TODO: should we return `doc`? It enables the exploration environment more usable,
    # but by default, `explore(...)` would display a widget in the notebook _and_ open a
    # sidecar for the same widget. The user would need to append a semicolon to disable
    # that behavior. We can't disable that behavior from within this function to the
    # best of my knowlwedge.
