from __future__ import annotations

import atexit
import os
import sys
from pathlib import Path
from typing import Any
from urllib.parse import unquote
from uuid import uuid4

from PyQt5.QtGui import QColor
from qgis.core import (
    QgsApplication,
    QgsColorRampShader,
    QgsCoordinateReferenceSystem,
    QgsDataSourceUri,
    QgsFillSymbol,
    QgsLayerTreeGroup,
    QgsLayerTreeLayer,
    QgsLineSymbol,
    QgsMapLayer,
    QgsMarkerSymbol,
    QgsProject,
    QgsRasterLayer,
    QgsRasterShader,
    QgsRectangle,
    QgsReferencedRectangle,
    QgsSettings,
    QgsSingleBandPseudoColorRenderer,
    QgsVectorLayer,
    QgsVectorTileLayer,
    QgsSingleSymbolRenderer,
    QgsCategorizedSymbolRenderer,
    QgsRendererCategory,
    QgsGraduatedSymbolRenderer,
    QgsRendererRange,
    Qgis,
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


def rgb_to_hex(rgb_str):
    """Converts an RGB string (comma-separated) to a hex color code."""
    rgb_values = rgb_str.split(",")[:3]
    r, g, b = [int(val) for val in rgb_values]
    return f"#{r:02x}{g:02x}{b:02x}"


def hex_to_rgba(hex_color):
    """Convert a hex color to an RGBA tuple."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 6:
        r, g, b = tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))
        a = 255  # Default alpha value
    elif len(hex_color) == 8:
        r, g, b, a = tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4, 6))
    else:
        raise ValueError(f"Invalid hex color: {hex_color}")

    return r, g, b, a


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

            # Need to build layer color
            renderer = layer.renderer()
            shader = renderer.shader()
            shaderFunc = shader.rasterShaderFunction()
            colorList = shaderFunc.colorRampItemList()
            band = renderer.band()
            source_min = renderer.classificationMin()
            source_max = renderer.classificationMax()

            # Remove "/vsicurl/" from source
            urls = [
                {
                    "url": layer.source()[9:],
                    "min": source_min,
                    "max": source_max,
                }
            ]

            colorRampTypeMap = {0: "interpolate", 1: "discrete", 2: "exact"}
            colorRampType = colorRampTypeMap[shaderFunc.colorRampType()]

            if colorRampType == "interpolate":
                color = [
                    "interpolate",
                    ["linear"],
                    ["band", float(band)],
                    0.0,
                    [0.0, 0.0, 0.0, 0.0],
                ]

                for node in colorList:
                    unscaled_val = (node.value * (1 - 0) - source_min * (1 - 0)) / (
                        source_max - source_min
                    )
                    color.append(unscaled_val)
                    color.append(
                        [
                            node.color.red(),
                            node.color.green(),
                            node.color.blue(),
                            float(node.color.alpha()) / 255,
                        ]
                    )

            if colorRampType == "discrete":
                color = _build_color_ramp("<=", colorList, band, source_min, source_max)

            if colorRampType == "exact":
                color = _build_color_ramp("==", colorList, band, source_min, source_max)

            source_parameters.update(urls=urls, normalize=True, wrapX=True)
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
    if isinstance(layer, QgsVectorLayer):
        layer_type = "VectorLayer"
        source_type = "GeoJSONSource"
        source = layer.source()

        if source.startswith("http://") or source.startswith("https://"):
            file_name = source
        else:
            components = source.split("/")
            file_name = components[-1]
            file_name = file_name.split("|")[0]

        source_parameters.update(path=file_name)

        renderer = layer.renderer()

        # Default symbol extraction
        symbol = None
        color = {}

        if isinstance(renderer, QgsSingleSymbolRenderer):
            symbol = renderer.symbol()
            if "symbologyState" not in layer_parameters:
                layer_parameters["symbologyState"] = {}

            layer_parameters["symbologyState"]["renderType"] = "Single Symbol"

        elif isinstance(renderer, QgsCategorizedSymbolRenderer):
            case_conditions = ["case"]
            field_name = renderer.classAttribute()
            for category in renderer.categories():
                cat_symbol = category.symbol()
                opacity = cat_symbol.opacity()

                category_color = cat_symbol.color().name()
                case_conditions.append(["==", ["get", field_name], category.value()])
                r, g, b, a = hex_to_rgba(category_color)
                case_conditions.append([r, g, b, a / 255])

            layer_parameters["symbologyState"] = {
                "colorRamp": "cool",
                "mode": "",
                "nClasses": "",
                "renderType": "Categorized",
                "value": field_name,
            }
            case_conditions.append([0.0, 0.0, 0.0, 0.0])
            outline_color_str = (
                cat_symbol.symbolLayer(0).properties().get("outline_color", "0,0,0,255")
            )
            if isinstance(cat_symbol, QgsMarkerSymbol):
                color["circle-fill-color"] = case_conditions
                color["circle-stroke-color"] = rgb_to_hex(outline_color_str)
                layer_parameters.update(type="circle")
            elif isinstance(cat_symbol, QgsLineSymbol):
                color["stroke-color"] = case_conditions
                color["stroke-line-cap"] = (
                    cat_symbol.symbolLayer(0).properties().get("capstyle")
                )
                color["stroke-line-join"] = (
                    cat_symbol.symbolLayer(0).properties().get("joinstyle")
                )
                color["stroke-width"] = float(
                    cat_symbol.symbolLayer(0).properties().get("line_width")
                )
                layer_parameters.update(type="line")
            elif isinstance(cat_symbol, QgsFillSymbol):
                color["fill-color"] = case_conditions
                color["stroke-color"] = rgb_to_hex(outline_color_str)
                layer_parameters.update(type="fill")

        elif isinstance(renderer, QgsGraduatedSymbolRenderer):
            field_name = renderer.classAttribute()
            interpolate_conditions = ["interpolate", ["linear"], ["get", field_name]]

            for range in renderer.ranges():
                range_symbol = range.symbol()
                opacity = range_symbol.opacity()
                alpha = opacity

                range_color = range_symbol.color().getRgbF()
                r, g, b, _ = range_color

                lower = range.upperValue()

                interpolate_conditions.append(lower)
                interpolate_conditions.append([r * 255, g * 255, b * 255, alpha])

            layer_parameters["symbologyState"] = {
                "renderType": "Graduated",
                "value": field_name,
            }

            # Determine geometry type and apply color interpolation
            if isinstance(range_symbol, QgsMarkerSymbol):
                color["circle-fill-color"] = interpolate_conditions
                color["circle-stroke-color"] = rgb_to_hex(
                    range_symbol.symbolLayer(0)
                    .properties()
                    .get("outline_color", "0,0,0,255")
                )
                layer_parameters.update(type="circle")
            elif isinstance(range_symbol, QgsLineSymbol):
                color["stroke-color"] = interpolate_conditions
                color["stroke-line-cap"] = (
                    range_symbol.symbolLayer(0).properties().get("capstyle")
                )
                color["stroke-line-join"] = (
                    range_symbol.symbolLayer(0).properties().get("joinstyle")
                )
                color["stroke-width"] = float(
                    range_symbol.symbolLayer(0).properties().get("line_width")
                )
                layer_parameters.update(type="line")
            elif isinstance(range_symbol, QgsFillSymbol):
                color["fill-color"] = interpolate_conditions
                color["stroke-color"] = rgb_to_hex(
                    range_symbol.symbolLayer(0)
                    .properties()
                    .get("outline_color", "0,0,0,255")
                )
                layer_parameters.update(type="fill")

        if symbol:
            # Opacity handling
            opacity = symbol.opacity()
            alpha = hex(int(opacity * 255))[2:].zfill(2)

            if isinstance(symbol, QgsMarkerSymbol):
                color["circle-fill-color"] = symbol.color().name()
                color["circle-stroke-color"] = symbol.color().name()
                layer_parameters.update(type="circle")

            elif isinstance(symbol, QgsLineSymbol):
                color["stroke-color"] = symbol.color().name()
                color["stroke-line-cap"] = (
                    symbol.symbolLayer(0).properties().get("capstyle")
                )
                color["stroke-line-join"] = (
                    symbol.symbolLayer(0).properties().get("joinstyle")
                )
                color["stroke-width"] = float(
                    symbol.symbolLayer(0).properties().get("line_width")
                )
                layer_parameters.update(type="line")

            elif isinstance(symbol, QgsFillSymbol):
                color["fill-color"] = symbol.color().name()
                outline_color_str = (
                    symbol.symbolLayer(0).properties().get("outline_color", "0,0,0,255")
                )
                color["stroke-color"] = rgb_to_hex(outline_color_str)
                layer_parameters.update(type="fill")

        layer_parameters.update(color=color)

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

        renderer = layer.renderer()
        styles = renderer.styles()
        color = {}

        for style in styles:
            symbol = style.symbol()
            geometry_type = style.geometryType()

            opacity = symbol.opacity()
            alpha = hex(int(opacity * 255))[2:].zfill(2)

            # 0 = points, 1 = lines, 2 = polygons
            if geometry_type == 0:
                color["circle-fill-color"] = symbol.color().name() + alpha
                color["circle-stroke-color"] = symbol.color().name() + alpha

            if geometry_type == 1:
                color["stroke-color"] = symbol.color().name() + alpha

            if geometry_type == 2:
                color["fill-color"] = symbol.color().name() + alpha

        layer_parameters.update(type="fill")
        layer_parameters.update(color=color)

    if layer_type is None:
        print(f"JUPYTERGIS - Unable to load layer type {type(layer)}")
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
    layer_parameters["opacity"] = layer.opacity()

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


def _build_color_ramp(operator, colorList, band, source_min, source_max):
    color = [
        "case",
        ["==", ["band", 1.0], 0.0],
        [0.0, 0.0, 0.0, 0.0],
    ]

    # Last entry is inf for discrete, so handle differently
    for node in colorList[:-1]:
        unscaled_val = (node.value * (1 - 0) - source_min * (1 - 0)) / (
            source_max - source_min
        )
        color.append([operator, ["band", float(band)], unscaled_val])
        color.append(
            [
                node.color.red(),
                node.color.green(),
                node.color.blue(),
                float(node.color.alpha()) / 255,
            ]
        )

    lastElement = colorList[-1]
    last_value = (
        source_max
        if operator == "<="
        else lastElement.value * (1 - 0) - source_min * (1 - 0)
    ) / (source_max - source_min)
    color.append([operator, ["band", float(band)], last_value])
    color.append(
        [
            lastElement.color.red(),
            lastElement.color.green(),
            lastElement.color.blue(),
            float(node.color.alpha()) / 255,
        ]
    )

    # Fallback value for openlayers
    color.append([0.0, 0.0, 0.0, 0.0])

    return color


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
            "useExtent": True,
            "projection": project.crs().authid(),
        },
        "metadata": {},
        **jgis_layer_tree,
    }


def get_base_symbol(geometry_type, color_params, opacity):
    """Returns a base symbol based on geometry type."""
    if geometry_type == "circle":
        symbol = QgsMarkerSymbol()
    elif geometry_type == "line":
        symbol = QgsLineSymbol()
    elif geometry_type == "fill":
        symbol = QgsFillSymbol()
    else:
        return None

    symbol.setOpacity(opacity)
    symbol.setOutputUnit(Qgis.RenderUnit.Pixels)
    symbol_layer = symbol.symbolLayer(0)

    if geometry_type == "circle":
        stroke_color = QColor(color_params.get("circle-stroke-color", "#000000"))
        symbol_layer.setStrokeColor(stroke_color)
        stroke_width = color_params.get("circle-stroke-width", 1)
        symbol_layer.setStrokeWidth(stroke_width)
    elif geometry_type == "line":
        stroke_width = color_params.get("stroke-width", 1)
        symbol_layer.setWidth(float(stroke_width))
    elif geometry_type == "fill":
        stroke_color = QColor(color_params.get("stroke-color", "#000000"))
        symbol_layer.setStrokeColor(stroke_color)
        stroke_width = color_params.get("stroke-width", 1)
        symbol_layer.setStrokeWidth(stroke_width)

    return symbol


def create_categorized_renderer(
    symbology_state, geometry_type, color_params, base_symbol
):
    """Creates a categorized renderer."""
    if geometry_type == "circle":
        fill_color_rules = color_params.get("circle-fill-color", [])
        radius_rules = color_params.get("circle-radius", [])
    elif geometry_type == "fill":
        fill_color_rules = color_params.get("fill-color", [])
    elif geometry_type == "line":
        fill_color_rules = color_params.get("stroke-color", [])

    renderer = QgsCategorizedSymbolRenderer(symbology_state.get("value"))

    for i in range(1, len(fill_color_rules) - 1, 2):
        condition = fill_color_rules[i]
        color = fill_color_rules[i + 1]

        if isinstance(color, list) and len(color) == 4:
            r, g, b, a = color
            color = [r, g, b, 1.0]

        category_symbol = base_symbol.clone()
        if isinstance(color, str) and color.startswith("#"):
            r, g, b, a = hex_to_rgba(color)
        elif isinstance(color, list) and len(color) == 4:
            r, g, b, a = color
            a *= 255
        else:
            raise ValueError(f"Unexpected color format: {color}")

        category_symbol = base_symbol.clone()
        category_symbol.setColor(QColor(int(r), int(g), int(b), int(a)))

        if geometry_type == "circle" and isinstance(radius_rules, (int, float)):
            radius = radius_rules
            category_symbol.setSize(2 * radius)
        elif geometry_type == "circle" and len(radius_rules) > i:
            radius = radius_rules[i + 3]
            category_symbol.setSize(2 * radius)

        category = QgsRendererCategory(condition[2], category_symbol, str(condition[2]))
        renderer.addCategory(category)

    return renderer


def create_graduated_renderer(
    symbology_state, geometry_type, color_params, base_symbol
):
    """Creates a graduated renderer."""
    if geometry_type == "circle":
        fill_color_rules = color_params.get("circle-fill-color", [])
        radius_rules = color_params.get("circle-radius", [])
    elif geometry_type == "fill":
        fill_color_rules = color_params.get("fill-color", [])
    elif geometry_type == "line":
        fill_color_rules = color_params.get("stroke-color", [])

    ranges = []
    previous_value = 0
    last_radius = None

    for i in range(3, len(fill_color_rules) - 2, 2):
        lower_value = fill_color_rules[i]
        upper_value = fill_color_rules[i + 2]
        color = fill_color_rules[i + 1]

        if isinstance(color, list) and len(color) == 4:
            r, g, b, a = color
            range_color = QColor(int(r), int(g), int(b), int(a * 255))

        range_symbol = base_symbol.clone()
        range_symbol.setColor(range_color)

        if geometry_type == "circle" and len(radius_rules) > i + 1:
            radius = radius_rules[i + 1]
            if isinstance(radius, (int, float)):
                range_symbol.setSize(2 * radius)
                last_radius = radius

        g_range = QgsRendererRange(
            previous_value,
            lower_value,
            range_symbol,
            f"{previous_value} - {lower_value}",
        )
        ranges.append(g_range)
        previous_value = lower_value

    if (
        isinstance(fill_color_rules[len(fill_color_rules) - 1], list)
        and len(fill_color_rules[len(fill_color_rules) - 1]) == 4
    ):
        r, g, b, a = fill_color_rules[len(fill_color_rules) - 1]
        last_color = QColor(int(r), int(g), int(b), int(a * 255))
    if last_color:
        final_symbol = base_symbol.clone()
        final_symbol.setColor(last_color)

        if geometry_type == "circle" and last_radius is not None:
            final_symbol.setSize(2 * last_radius)

        g_range = QgsRendererRange(
            previous_value,
            upper_value,
            final_symbol,
            f"{previous_value} - {upper_value}",
        )
        ranges.append(g_range)

    return QgsGraduatedSymbolRenderer(symbology_state.get("value"), ranges)


def jgis_layer_to_qgis(
    layer_id: str,
    layers: dict[str, dict[str, Any]],
    sources: dict[str, dict[str, Any]],
    settings: QgsSettings,
    logs: dict[str, list[str]],
) -> QgsMapLayer | None:
    # The function that build the URI from the source parameters.
    def build_uri(parameters: dict[str, str], source_type: str) -> str | None:
        layer_config = {}
        zmax = parameters.get("maxZoom", None)
        zmin = parameters.get("minZoom", 0)

        if source_type in ["RasterSource", "VectorTileSource"]:
            url = parameters.get("url", None)
            if url is None:
                return
            urlParameters = parameters.get("urlParameters", None)
            if urlParameters:
                for k, v in urlParameters.items():
                    url = url.replace(f"{{{k}}}", v)
            layer_config["url"] = url
            layer_config["type"] = "xyz"

        if source_type == "GeoJSONSource":
            path = parameters.get("path", None)
            return path

        if source_type == "RasterSource":
            layer_config["crs"] = "EPSG:3857"

        layer_config["zmin"] = str(round(zmin))
        if zmax:
            layer_config["zmax"] = str(round(zmax))
        uri = QgsDataSourceUri()
        for key, val in layer_config.items():
            uri.setParam(key, val)
        return bytes(uri.encodedUri()).decode()

    layer = layers.get(layer_id, None)
    if layer is None:
        logs["warnings"].append(
            f"Layer {layer_id} not exported: the layer {layer_id} is not in layer list"
        )
        return
    source_id = layer.get("parameters", {}).get("source", "")
    source = sources.get(source_id, None)
    if source is None:
        logs["warnings"].append(
            f"Layer {layer_id} not exported: the source {source_id} is not in source list"
        )
        return

    map_layer = None

    layer_name = layer.get("name", "")
    layer_type = layer.get("type", None)
    source_type = source.get("type", None)
    if any([v is None for v in [layer_name, layer_type, source_type]]):
        logs["warnings"].append(
            f"Layer {layer_id} not exported: at least one of layer name, layer type or source type is missing."
        )
        return

    if layer_type == "RasterLayer" and source_type == "RasterSource":
        source_parameters = source.get("parameters", {})
        uri = build_uri(source_parameters, "RasterSource")
        map_layer = QgsRasterLayer(uri, layer_name, "wms")

    if layer_type == "VectorTileLayer" and source_type == "VectorTileSource":
        source_parameters = source.get("parameters", {})
        color_params = layer["parameters"]["color"]
        uri = build_uri(source_parameters, "VectorTileSource")

        map_layer = QgsVectorTileLayer(uri, layer_name)
        renderer = map_layer.renderer()
        styles = renderer.styles()
        parsed_styles = []

        if color_params:
            for style in styles:
                symbol = style.symbol()

                geometry_type = style.geometryType()
                # 0 = points, 1 = lines, 2 = polygons
                # Slice color_params to get rid of the opacity value from the hex string
                if geometry_type == 0:
                    symbol.setColor(QColor(color_params["circle-fill-color"][:7]))
                    opacity = int(color_params["circle-fill-color"][-2:], 16) / 255
                    symbol.setOpacity(opacity)

                if geometry_type == 1:
                    symbol.setColor(QColor(color_params["stroke-color"][:7]))
                    opacity = int(color_params["stroke-color"][-2:], 16) / 255
                    symbol.setOpacity(opacity)

                if geometry_type == 2:
                    symbol.setColor(QColor(color_params["fill-color"][:7]))
                    opacity = int(color_params["fill-color"][-2:], 16) / 255
                    symbol.setOpacity(opacity)

                parsed_styles.append(style)

            renderer.setStyles(parsed_styles)

    if layer_type == "VectorLayer" and source_type == "GeoJSONSource":
        source_parameters = source.get("parameters", {})
        uri = build_uri(source_parameters, "GeoJSONSource")
        if not uri:
            logs["warnings"].append(
                f"Layer {layer_id} not exported: invalid GeoJSON source."
            )
            return

        # Not checking for file.isValid() since it will eventually fail to load the file (relative path on the original file does not match server root)
        map_layer = QgsVectorLayer(uri, layer_name, "ogr")
        crs_84 = QgsCoordinateReferenceSystem("EPSG:4326")
        map_layer.setCrs(crs_84)

        geometry_type = layer.get("parameters", {}).get("type")
        layer_params = layer.get("parameters", {})

        if geometry_type == "circle":
            symbol = QgsMarkerSymbol()
            color_params = layer_params.get("color", {})
            opacity = layer_params.get("opacity", 1.0)
            symbology_state = layer_params.get("symbologyState", {})
            render_type = symbology_state.get("renderType", "Single Symbol")

            symbol = get_base_symbol(geometry_type, color_params, opacity)

            render_type = symbology_state.get("renderType", "Single Symbol")

            if render_type == "Single Symbol":
                fill_color = QColor(color_params.get("circle-fill-color"))
                symbol.setColor(fill_color)
                radius = color_params.get("circle-radius", 5)
                symbol.setSize(2 * radius)
                renderer = QgsSingleSymbolRenderer(symbol)

            elif render_type == "Categorized":
                renderer = create_categorized_renderer(
                    symbology_state, geometry_type, color_params, symbol
                )

            elif render_type == "Graduated":
                renderer = create_graduated_renderer(
                    symbology_state, geometry_type, color_params, symbol
                )

        elif geometry_type == "line":
            symbol = QgsLineSymbol()
            symbol.setOutputUnit(Qgis.RenderUnit.Pixels)
            color_params = layer_params.get("color", {})

            opacity = layer_params.get("opacity")

            symbology_state = layer_params.get("symbologyState", {})
            render_type = symbology_state.get("renderType", "Single Symbol")

            symbol = get_base_symbol(geometry_type, color_params, opacity)

            render_type = symbology_state.get("renderType", "Single Symbol")

            if render_type == "Single Symbol":
                fill_color = QColor(color_params.get("stroke-color"))
                symbol.setColor(fill_color)
                renderer = QgsSingleSymbolRenderer(symbol)

            elif render_type == "Categorized":
                renderer = create_categorized_renderer(
                    symbology_state, geometry_type, color_params, symbol
                )

            elif render_type == "Graduated":
                renderer = create_graduated_renderer(
                    symbology_state, geometry_type, color_params, symbol
                )

        elif geometry_type == "fill":
            symbol = QgsFillSymbol()
            symbol.setOutputUnit(Qgis.RenderUnit.Pixels)
            color_params = layer_params.get("color", {})
            opacity = layer_params.get("opacity", 1.0)

            symbology_state = layer_params.get("symbologyState", {})
            render_type = symbology_state.get("renderType", "Single Symbol")

            symbol = get_base_symbol(geometry_type, color_params, opacity)

            render_type = symbology_state.get("renderType", "Single Symbol")

            if render_type == "Single Symbol":
                fill_color = QColor(color_params.get("fill-color"))
                stroke_color = QColor(color_params.get("stroke-color"))
                symbol.setColor(fill_color)
                symbol_layer = symbol.symbolLayer(0)
                symbol_layer.setStrokeColor(stroke_color)
                renderer = QgsSingleSymbolRenderer(symbol)

            elif render_type == "Categorized":
                renderer = create_categorized_renderer(
                    symbology_state, geometry_type, color_params, symbol
                )

            elif render_type == "Graduated":
                renderer = create_graduated_renderer(
                    symbology_state, geometry_type, color_params, symbol
                )

        map_layer.setRenderer(renderer)

    if layer_type == "WebGlLayer" and source_type == "GeoTiffSource":
        source_parameters = source.get("parameters", {})
        # TODO: Support sources with multiple URLs
        url = "/vsicurl/" + source_parameters["urls"][0]["url"]
        map_layer = QgsRasterLayer(url, layer_name, "gdal")

        layer_colors = layer["parameters"]["color"]

        source_min = source_parameters["urls"][0]["min"]
        source_max = source_parameters["urls"][0]["max"]

        # Create a color ramp shader
        color_ramp_shader = QgsColorRampShader()
        color_stops = []

        if layer_colors[0] == "interpolate":
            selected_band = layer_colors[2][1]
            color_ramp_shader.setColorRampType(QgsColorRampShader.Interpolated)

            # Define color stops
            for index in range(5, len(layer_colors), 2):
                scaled_value = (layer_colors[index] * (source_max - source_min)) / (
                    1 - 0
                ) + source_min

                colors = layer_colors[index + 1]
                color_stops.append(
                    QgsColorRampShader.ColorRampItem(
                        scaled_value,
                        QColor(
                            int(colors[0]),
                            int(colors[1]),
                            int(colors[2]),
                            int(colors[3] * 255),
                        ),
                    ),
                )

        if layer_colors[0] == "case":
            selected_band = layer_colors[1][1][1]
            # check logical operator to choose discrete or exact
            op = layer_colors[3][0]

            # skip the last value in both cases, thats the fallback and not used by qgis
            if op == "<=":
                # skip the second to last pair because that needs special handling
                color_ramp_shader.setColorRampType(QgsColorRampShader.Discrete)
                endIndex = len(layer_colors) - 3
            if op == "==":
                color_ramp_shader.setColorRampType(QgsColorRampShader.Exact)
                endIndex = len(layer_colors) - 1

            # skip the first pair, that's for open layers to handle NoData values
            for index in range(3, endIndex, 2):
                val = layer_colors[index][2]
                scaled_value = (val * (source_max - source_min)) / (1 - 0) + source_min
                colors = layer_colors[index + 1]
                color_stops.append(
                    QgsColorRampShader.ColorRampItem(
                        scaled_value,
                        QColor(
                            int(colors[0]),
                            int(colors[1]),
                            int(colors[2]),
                            int(colors[3] * 255),
                        ),
                    ),
                )

            # Final stop in qgis for discrete has inf value
            if op == "<=":
                color_stops.append(
                    QgsColorRampShader.ColorRampItem(
                        float("inf"),
                        QColor(
                            int(layer_colors[-2][0]),
                            int(layer_colors[-2][1]),
                            int(layer_colors[-2][2]),
                            int(layer_colors[-2][3] * 255),
                        ),
                    ),
                )

        color_ramp_shader.setColorRampItemList(color_stops)
        color_ramp_shader.setClip(True)

        # Create a raster shader
        raster_shader = QgsRasterShader()
        raster_shader.setRasterShaderFunction(color_ramp_shader)

        # Create the renderer
        renderer = QgsSingleBandPseudoColorRenderer(
            map_layer.dataProvider(),
            int(selected_band),
            raster_shader,
        )

        # Set minimum and maximum values
        renderer.setClassificationMin(source_min)
        renderer.setClassificationMax(source_max)

        # Apply the renderer to the layer
        map_layer.setRenderer(renderer)

    if map_layer is None:
        logs["warnings"].append(
            f"Layer {layer_id} not exported: enable to export layer type {layer_type}"
        )
        print(f"JUPYTERGIS - Unable to export layer type {layer_type}")
        return

    map_layer.setId(layer_id)
    map_layer.setOpacity(layer.get("parameters", {}).get("opacity", 1.0))

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
    logs: dict[str, list[str]],
) -> None:
    for item in layer_group:
        if isinstance(item, str):
            # Item is a layer id
            qgis_layer = jgis_layer_to_qgis(item, layers, sources, settings, logs)
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
                item.get("layers", []),
                layers,
                sources,
                newGroup,
                project,
                settings,
                logs,
            )


def export_project_to_qgis(
    path: str | Path, virtual_file: dict[str, Any]
) -> dict[str, list[str]]:
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

    logs = {"warnings": [], "errors": []}

    jgis_layer_group_to_qgis(
        virtual_file["layerTree"],
        virtual_file["layers"],
        virtual_file["sources"],
        root,
        project,
        qgis_settings,
        logs,
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
            logs["warnings"].append(
                "The 'extent' parameter is missing to save the viewport"
            )
            print("The 'extent' parameter is missing to save the viewport")

    if not project.write(path):
        logs["errors"].append(f"Error when saving the file {path}")
    return logs
