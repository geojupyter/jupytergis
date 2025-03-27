from sidecar import Sidecar

from jupytergis_lab import GISDocument


def geo_debug(geojson_path: str) -> None:
    """Run a JupyterGIS data interaction interface alongside a Notebook."""
    doc = GISDocument()

    # TODO: Basemap choices
    doc.add_raster_layer(
        "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}"
    )

    # TODO: Support lots of file types, and support Python objects like geodataframes.
    doc.add_geojson_layer(geojson_path)

    # TODO: Zoom to layer; is that feasible to do from Python? Currently not exposed in
    #       Python API.

    # TODO: Make map take up the whole sidebar space.
    # TODO: Activate left and right panel -- not sure how feasible yet from Python.
    #       Also, if using sidecar, right panel can't be displayed. Can we open a
    #       "native" JupyterLab pane instead of using sidecar?

    sc = Sidecar(title="JupyterGIS sidecar", anchor="split-right")
    with sc:
        display(doc)
