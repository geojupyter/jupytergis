from __future__ import annotations

from pathlib import Path
from typing import Any
from urllib.parse import unquote
from uuid import uuid4

from qgis.core import (
    QgsLayerTreeGroup,
    QgsLayerTreeLayer,
    QgsRasterLayer,
    QgsVectorTileLayer,
    QgsProject,
)

from jupytergis_lab.notebook.utils import get_source_layer_names


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

    # extract the viewport in lat/long coordinates
    view_settings = project.viewSettings()
    map_extent = view_settings.defaultViewExtent()

    return {
        "options": {
            "bearing": 0.0,
            "pitch": 0,
            "extent": [
                map_extent.xMinimum(),
                map_extent.yMinimum(),
                map_extent.xMaximum(),
                map_extent.yMaximum()
            ]
        },
        **jgis_layer_tree,
    }
