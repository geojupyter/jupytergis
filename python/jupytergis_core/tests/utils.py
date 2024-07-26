from __future__ import annotations

from pathlib import Path
from urllib.parse import unquote
from uuid import uuid4

from qgis.core import (
    QgsApplication,
    QgsLayerTreeGroup,
    QgsLayerTreeLayer,
    QgsRasterLayer,
    QgsProject,
)


def qgis_to_jgis(
    node: QgsLayerTreeGroup,
    layer_tree: list | None = None,
    layers: dict[str, dict[str, Any]] | None = None,
    sources: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]] | None:
    do_return = False
    if layer_tree is None:
        do_return = True
        layer_tree = []
        layers = {}
        sources = {}
    children = node.children()
    for child in children:
        is_visible = child.isVisible()
        if isinstance(child, QgsLayerTreeGroup):
            _layer_tree = []
            group = {
                "layers": _layer_tree,
                "name": child.name(),
            }
            layer_tree.append(group)
            qgis_to_jgis(child, _layer_tree, layers, sources)
        elif isinstance(child, QgsLayerTreeLayer):
            layer = child.layer()
            layer_name = layer.name()
            layer_type = None
            parameters = {}
            if isinstance(layer, QgsRasterLayer):
                layer_type = "RasterLayer"
                source_params = layer.source().split("&")
                url = ""
                max_zoom = 0
                min_zoom = 0
                for param in source_params:
                    if param.startswith("url="):
                        url = unquote(param[4:])
                    elif param.startswith("zmax="):
                        max_zoom = int(param[5:])
                    elif param.startswith("zmin="):
                        min_zoom = int(param[5:])
                parameters.update(
                    url=url,
                    maxZoom=max_zoom,
                    minZoom=min_zoom,
                )
            layer_id = layer.id()
            layer_tree.append(layer_id)
            source_id = str(uuid4())
            layers[layer_id] = {
                "name": layer_name,
                "parameters": {
                    "source": source_id,
                },
                "type": layer_type,
                "visible": is_visible,
            }
            sources[source_id] = {
                "name": layer_name,
                "type": layer_type,
                "parameters": parameters,
            }
    if do_return:
        return {
            "layers": layers,
            "sources": sources,
            "layerTree": layer_tree
        }


def import_project_from_qgis(path: str | Path, qgis_app: QgsQpplication):
    if isinstance(path, Path):
        path = str(path)

    project = QgsProject.instance()
    project.read(path)
    layer_tree_root = project.layerTreeRoot()

    jgis_layer_tree = qgis_to_jgis(layer_tree_root)

    return jgis_layer_tree
