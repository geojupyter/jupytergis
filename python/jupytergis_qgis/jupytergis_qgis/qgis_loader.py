from __future__ import annotations

import atexit
import os
import sys
from pathlib import Path
from typing import Any
from urllib.parse import unquote
from uuid import uuid4

from jupytergis_lab.notebook.utils import get_source_layer_names
from qgis.core import (
    QgsApplication,
    QgsCoordinateReferenceSystem,
    QgsDataSourceUri,
    QgsLayerTreeGroup,
    QgsLayerTreeLayer,
    QgsMapLayer,
    QgsProject,
    QgsRasterLayer,
    QgsRectangle,
    QgsReferencedRectangle,
    QgsSettings,
    QgsVectorTileLayer,
)

# Prevent any Qt application and event loop to spawn when
# using the QGIS Python app
os.environ["QT_QPA_PLATFORM"] = "offscreen"

QgsApplication.setPrefixPath(sys.prefix)

qgs = QgsApplication([], False)
qgs.initQgis()


@atexit.register
def closeQgis():
    qgs.exitQgis()


def qgis_layer_to_jgis(
    qgis_layer: QgsLayerTreeLayer,
    layers: dict[str, dict[str, Any]],
    sources: dict[str, dict[str, Any]],
    settings: QgsSettings | None,
) -> str:
    """Load a QGIS layer into the provided layers/sources dictionary in the JGIS format. Returns the layer id or None if enable to load the layer."""
    layer = qgis_layer.layer()
    if layer is None:
        return

    layer_name = layer.name()
    is_visible = qgis_layer.isVisible()
    layer_type = None
    source_type = None

    layer_parameters = {}
    source_parameters = {}

    if isinstance(layer, QgsRasterLayer):
        # QGIS treats tif layers as raster layer
        if layer.source().endswith(".tif"):
            layer_type = "WebGlLayer"
            source_type = "GeoTiffSource"

            # Remove "/vsicurl/" from source
            urls = [{"url": layer.source()[9:]}]

            # Need to build layer color
            renderer = layer.renderer()
            shader = renderer.shader()
            shaderFunc = shader.rasterShaderFunction()
            colorList = shaderFunc.colorRampItemList()
            band = renderer.band()

            colorRampTypeMap = {0: "interpolate", 1: "discrete", 2: "exact"}
            colorRampType = colorRampTypeMap[shaderFunc.colorRampType()]

            # TODO: Only supports linear interpolation for now

            if colorRampType == "interpolate":
                color = [
                    "interpolate",
                    ["linear"],
                    ["band", float(band)],
                ]
                for node in colorList:
                    color.append(node.value)
                    color.append(
                        [node.color.red(), node.color.green(), node.color.blue()]
                    )

            if colorRampType == "discrete":
                color = [
                    "case",
                ]
                # Last entry is used for the fallback value in jgis
                for node in colorList[:-1]:
                    color.append(["<=", ["band", float(band)], node.value])
                    color.append(
                        [node.color.red(), node.color.green(), node.color.blue()]
                    )
                lastElement = colorList[-1]
                color.append(
                    [
                        lastElement.color.red(),
                        lastElement.color.green(),
                        lastElement.color.blue(),
                    ]
                )

            if colorRampType == "exact":
                color = [
                    "case",
                ]
                # Last entry is used for the fallback value in jgis
                for node in colorList[:-1]:
                    color.append(["==", ["band", float(band)], node.value])
                    color.append(
                        [node.color.red(), node.color.green(), node.color.blue()]
                    )
                lastElement = colorList[-1]
                color.append(
                    [
                        lastElement.color.red(),
                        lastElement.color.green(),
                        lastElement.color.blue(),
                    ]
                )

            # TODO: Could probably look at RGB values to see what normalize should be
            source_parameters.update(urls=urls, normalize=False, wrapX=True)
            layer_parameters.update(color=color)

        else:
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

    if settings:
        layerSourceMap = settings.value("layerSourceMap", {})
        source_id = layerSourceMap.get(layer_id, {}).get("source_id", str(uuid4()))
        source_name = layerSourceMap.get(layer_id, {}).get(
            "source_name", f"{layer_name} Source"
        )
    else:
        source_id = str(uuid4())
        source_name = f"{layer_name} Source"

    layer_parameters["source"] = source_id

    layers[layer_id] = {
        "name": layer_name,
        "parameters": layer_parameters,
        "type": layer_type,
        "visible": is_visible,
    }
    sources[source_id] = {
        "name": source_name,
        "type": source_type,
        "parameters": source_parameters,
    }

    return layer_id


def qgis_layer_tree_to_jgis(
    node: QgsLayerTreeGroup,
    layer_tree: list | None = None,
    layers: dict[str, dict[str, Any]] | None = None,
    sources: dict[str, dict[str, Any]] | None = None,
    settings: QgsSettings | None = None,
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
            qgis_layer_tree_to_jgis(child, _layer_tree, layers, sources, settings)
        elif isinstance(child, QgsLayerTreeLayer):
            layer_id = qgis_layer_to_jgis(child, layers, sources, settings)
            if layer_id is not None:
                layer_tree.append(layer_id)

    return {"layers": layers, "sources": sources, "layerTree": layer_tree}


def import_project_from_qgis(path: str | Path):
    if isinstance(path, Path):
        path = str(path)

    # TODO Silent stdout when creating the project?
    project = QgsProject.instance()
    project.clear()
    project.read(path)
    layer_tree_root = project.layerTreeRoot()
    qgis_settings = QgsSettings()
    jgis_layer_tree = qgis_layer_tree_to_jgis(layer_tree_root, settings=qgis_settings)

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
                map_extent.yMaximum(),
            ],
        },
        **jgis_layer_tree,
    }


def jgis_layer_to_qgis(
    layer_id: str,
    layers: dict[str, dict[str, Any]],
    sources: dict[str, dict[str, Any]],
    settings: QgsSettings,
) -> QgsMapLayer | None:
    def build_uri(parameters: dict[str, str], source_type: str) -> str | None:
        layer_config = dict()
        zmax = parameters.get("maxZoom", None)
        zmin = parameters.get("minZoom", 0)

        if source_type in ["RasterSource", "VectorTileSource"]:
            url = parameters.get("url", None)
            if url is None:
                return
            layer_config["url"] = url
            layer_config["type"] = "xyz"

        if source_type == "RasterSource":
            layer_config["crs"] = "EPSG:3857"

        layer_config["zmin"] = str(zmin)
        if zmax:
            layer_config["zmax"] = str(zmax)

        uri = QgsDataSourceUri()
        for key, val in layer_config.items():
            uri.setParam(key, val)

        return bytes(uri.encodedUri()).decode()

    layer = layers.get(layer_id, None)
    if layer is None:
        return
    source_id = layer.get("parameters", {}).get("source", "")
    source = sources.get(source_id, None)
    if source is None:
        return

    map_layer = None

    layer_name = layer.get("name", "")
    layer_type = layer.get("type", None)
    source_type = source.get("type", None)
    if any([v is None for v in [layer_name, layer_type, source_type]]):
        return

    if layer_type == "RasterLayer" and source_type == "RasterSource":
        parameters = source.get("parameters", {})
        uri = build_uri(parameters, "RasterSource")
        map_layer = QgsRasterLayer(uri, layer_name, "wms")

    if layer_type == "VectorTileLayer" and source_type == "VectorTileSource":
        parameters = source.get("parameters", {})
        uri = build_uri(parameters, "VectorTileSource")
        map_layer = QgsVectorTileLayer(uri, layer_name)

    if layer_type == "WebGlLayer" and source_type == "GeoTiffSource":
        parameters = source.get("parameters", {})
        # TODO: Support sources with multiple URLs
        url = "/vsicurl/" + parameters["urls"][0]["url"]
        map_layer = QgsRasterLayer(url, layer_name, "gdal")

    if map_layer is None:
        print(f"JUPYTERGIS - Enable to export layer type {layer_type}")
        return

    map_layer.setId(layer_id)

    # Map the source id/name to the layer
    layerSourceMap = settings.value("layerSourceMap", {})
    layerSourceMap[layer_id] = {
        "source_id": source_id,
        "source_name": source.get("name", f"{layer_name} Source"),
    }
    settings.setValue("layerSourceMap", layerSourceMap)

    return map_layer


def jgis_layer_group_to_qgis(
    layer_group: list,
    layers: dict[str, dict[str, Any]],
    sources: dict[str, dict[str, Any]],
    qgisGroup: QgsLayerTreeGroup,
    project: QgsProject,
    settings: QgsSettings,
) -> None:
    for item in layer_group:
        if isinstance(item, str):
            # Item is a layer id
            qgis_layer = jgis_layer_to_qgis(item, layers, sources, settings)
            if qgis_layer is not None:
                project.addMapLayer(qgis_layer, False)
                layer = qgisGroup.addLayer(qgis_layer)
                layer.setItemVisibilityChecked(layers[item].get("visible", True))
        else:
            # Item is a group
            name = item.get("name", str(uuid4()))
            qgisGroup.addGroup(name)
            newGroup = qgisGroup.findGroup(name)
            jgis_layer_group_to_qgis(
                item.get("layers", []), layers, sources, newGroup, project, settings
            )


def export_project_to_qgis(path: str | Path, virtual_file: dict[str, Any]) -> bool:
    if not all(k in virtual_file for k in ["layers", "sources", "layerTree"]):
        return

    if isinstance(path, Path):
        path = str(path)

    project = QgsProject.instance()
    if os.path.exists(path):
        project.read(path)
        root = project.layerTreeRoot()
        root.clear()
    else:
        project.clear()
        root = project.layerTreeRoot()

    if not project.crs().isValid():
        dst_crs_id = "EPSG:3857"
        crs = QgsCoordinateReferenceSystem(dst_crs_id)
        project.setCrs(crs)

    qgis_settings = QgsSettings()

    jgis_layer_group_to_qgis(
        virtual_file["layerTree"],
        virtual_file["layers"],
        virtual_file["sources"],
        root,
        project,
        qgis_settings,
    )

    view_settings = project.viewSettings()
    src_csr_id = "EPSG:3857"
    if "projection" in virtual_file["options"]:
        src_csr_id = virtual_file["options"]["projection"]

    if "options" in virtual_file:
        if "extent" in virtual_file["options"]:
            extent = virtual_file["options"]["extent"]
            view_settings.setDefaultViewExtent(
                QgsReferencedRectangle(
                    QgsRectangle(*extent), QgsCoordinateReferenceSystem(src_csr_id)
                )
            )
        else:
            print("The 'extent' parameter is missing to save the viewport")

    return project.write(path)
