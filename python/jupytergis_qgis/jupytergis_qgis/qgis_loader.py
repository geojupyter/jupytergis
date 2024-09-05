from __future__ import annotations

from pathlib import Path
from urllib.parse import unquote
from uuid import uuid4

from qgis.PyQt.QtCore import QSize
from qgis.core import (
    QgsApplication,
    QgsLayerTreeGroup,
    QgsLayerTreeLayer,
    QgsRasterLayer,
    QgsVectorTileLayer,
    QgsProject,
    QgsMapSettings,
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsReferencedRectangle,
)

from jupytergis_lab.notebook.utils import get_source_layer_names


# Part of this code is copied from https://github.com/felt/qgis-plugin (GPL-2.0 license)
class MapUtils:
    ZOOM_LEVEL_SCALE_BREAKS = [
        591657527.591555,
        295828763.795777,
        147914381.897889,
        73957190.948944,
        36978595.474472,
        18489297.737236,
        9244648.868618,
        4622324.434309,
        2311162.217155,
        1155581.108577,
        577790.554289,
        288895.277144,
        144447.638572,
        72223.819286,
        36111.909643,
        18055.954822,
        9027.977411,
        4513.988705,
        2256.994353,
        1128.497176,
        564.248588,
        282.124294,
        141.062147,
        70.5310735,
    ]

    @staticmethod
    def map_scale_to_tile_zoom(scale: float) -> int:
        """
        Returns the tile zoom level roughly
        corresponding to a QGIS map scale
        """
        for level, min_scale in enumerate(MapUtils.ZOOM_LEVEL_SCALE_BREAKS):
            if min_scale < scale:
                # we play it safe and zoom out a step -- this is because
                # we don't know the screen size or DPI on which the map
                # will actually be viewed, so we err on the conservative side
                return level - 1

        return len(MapUtils.ZOOM_LEVEL_SCALE_BREAKS) - 1

    @staticmethod
    def calculate_tile_zoom_for_extent(
        extent: QgsReferencedRectangle,
        target_map_size: QSize,
    ) -> int:
        """
        Calculates the required leaflet tile zoom level in order
        to completely fit a specified extent.

        :param extent: required minimum map extent
        :param target_map_size: size of leaflet map, in pixels
        """

        map_settings = QgsMapSettings()
        map_settings.setDestinationCrs(extent.crs())
        map_settings.setExtent(extent)
        map_settings.setOutputDpi(96)
        map_settings.setOutputSize(target_map_size)

        scale = map_settings.scale()
        return MapUtils.map_scale_to_tile_zoom(scale)


def qgis_layer_to_jgis(
    qgis_layer: QgsLayerTreeLayer,
    layers: dict[str, dict[str, Any]],
    sources: dict[str, dict[str, Any]],
) -> str:
    """Load a QGIS layer into the provided layers/sources dictionary in the JGIS format. Returns the layer id or None if enable to load the layer."""
    layer = qgis_layer.layer()
    layer_name = layer.name()
    is_visible = qgis_layer.isVisible()
    layer_type = None
    source_type = None
    source_id = str(uuid4())
    layer_parameters = {
        "source": source_id,
    }
    source_parameters = {}

    if isinstance(layer, QgsRasterLayer):
        layer_type = "RasterLayer"
        source_type = "RasterSource"
        source_params = layer.source().split("&")
        url = ""
        max_zoom = 24
        min_zoom = 0
        for param in source_params:
            if param.startswith("url="):
                url = unquote(param[4:])
            elif param.startswith("zmax="):
                max_zoom = int(param[5:])
            elif param.startswith("zmin="):
                min_zoom = int(param[5:])
        source_parameters.update(
            url=url,
            maxZoom=max_zoom,
            minZoom=min_zoom,
        )

    if isinstance(layer, QgsVectorTileLayer):
        layer_type = "VectorTileLayer"
        source_type = "VectorTileSource"
        source_params = layer.source().split("&")
        url = ""
        max_zoom = 24
        min_zoom = 0
        for param in source_params:
            if param.startswith("url="):
                url = unquote(param[4:])
            elif param.startswith("zmax="):
                max_zoom = int(param[5:])
            elif param.startswith("zmin="):
                min_zoom = int(param[5:])
        source_parameters.update(
            url=url,
            maxZoom=max_zoom,
            minZoom=min_zoom,
        )
        # TODO Load source-layer properly, from qgis symbology?
        try:
            source_layer = get_source_layer_names(url)[0]
            layer_parameters["sourceLayer"] = source_layer
        except ValueError:
            pass
        # TODO Load style properly
        layer_parameters.update(type="fill")

    if layer_type is None:
        print(f"JUPYTERGIS - Enable to load layer type {type(layer)}")
        return

    layer_id = layer.id()

    layers[layer_id] = {
        "name": layer_name,
        "parameters": layer_parameters,
        "type": layer_type,
        "visible": is_visible,
    }
    sources[source_id] = {
        "name": f"{layer_name} Source",
        "type": source_type,
        "parameters": source_parameters,
    }

    return layer_id


def qgis_layer_tree_to_jgis(
    node: QgsLayerTreeGroup,
    layer_tree: list | None = None,
    layers: dict[str, dict[str, Any]] | None = None,
    sources: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]] | None:
    if layer_tree is None:
        layer_tree = []
        layers = {}
        sources = {}

    children = node.children()
    for child in children:
        if isinstance(child, QgsLayerTreeGroup):
            _layer_tree = []
            group = {
                "layers": _layer_tree,
                "name": child.name(),
            }
            layer_tree.append(group)
            qgis_layer_tree_to_jgis(child, _layer_tree, layers, sources)
        elif isinstance(child, QgsLayerTreeLayer):
            layer_id = qgis_layer_to_jgis(child, layers, sources)
            if layer_id is not None:
                layer_tree.append(layer_id)

    return {"layers": layers, "sources": sources, "layerTree": layer_tree}


def import_project_from_qgis(path: str | Path):
    if isinstance(path, Path):
        path = str(path)

    # TODO Silent stdout when creating the project?
    project = QgsProject.instance()
    project.read(path)
    layer_tree_root = project.layerTreeRoot()

    jgis_layer_tree = qgis_layer_tree_to_jgis(layer_tree_root)

    # Infer zoom level and center
    # TODO Extract projection type when we support multiple types
    view_settings = project.viewSettings()
    current_map_extent = view_settings.defaultViewExtent()
    current_map_crs = view_settings.defaultViewExtent().crs()
    transform_context = project.transformContext()

    transform_4326 = QgsCoordinateTransform(
        current_map_crs, QgsCoordinateReferenceSystem("EPSG:4326"), transform_context
    )
    try:
        map_extent_4326 = transform_4326.transformBoundingBox(current_map_extent)
    except QgsCsException:
        map_extent_4326 = current_map_extent

    map_center = map_extent_4326.center()

    initial_zoom_level = MapUtils.calculate_tile_zoom_for_extent(
        QgsReferencedRectangle(current_map_extent, current_map_crs), QSize(1024, 800)
    )

    return {
        "options": {
            "bearing": 0.0,
            "pitch": 0,
            "latitude": map_center[1],
            "longitude": map_center[0],
            "zoom": initial_zoom_level,
        },
        **jgis_layer_tree,
    }
