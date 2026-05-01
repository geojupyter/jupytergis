from __future__ import annotations

import atexit
import json
import os
import sys
from pathlib import Path
from typing import Any
from urllib.parse import unquote
from uuid import uuid4

from jupytergis_core.color_ramps import sample_colors
from jupytergis_core.colors import hex_to_rgba, rgb_to_hex
from PyQt5.QtGui import QColor
from qgis.core import (  # type: ignore[import-untyped]
    Qgis,
    QgsApplication,
    QgsCategorizedSymbolRenderer,
    QgsColorRampShader,
    QgsCoordinateReferenceSystem,
    QgsDataSourceUri,
    QgsFillSymbol,
    QgsGradientColorRamp,
    QgsGraduatedSymbolRenderer,
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
    QgsRendererCategory,
    QgsSettings,
    QgsSingleBandPseudoColorRenderer,
    QgsSingleSymbolRenderer,
    QgsVectorLayer,
    QgsVectorTileLayer,
)

# Custom property keys stored on QGIS layers to survive round-trip.
PROP_GEOMETRY_TYPE = "jgis_symbology_geometryType"
PROP_STROKE_COLOR = "jgis_symbology_strokeColor"
PROP_CAP_STYLE = "jgis_symbology_capStyle"
PROP_JOIN_STYLE = "jgis_symbology_joinStyle"
PROP_STROKE_WIDTH = "jgis_symbology_strokeWidth"

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
        return None

    layer_name = layer.name()
    is_visible = qgis_layer.isVisible()
    layer_type = None
    source_type = None

    layer_parameters = {}
    source_parameters = {}

    if isinstance(layer, QgsRasterLayer):
        # QGIS treats tif layers as raster layer
        if layer.source().endswith(".tif"):
            layer_type = "GeoTiffLayer"
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
                },
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
                        ],
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

        # Build symbologyState as the single source of truth (#698).
        # No `color` (OL FlatStyle) is persisted — it's derived on the fly.
        symbol = None
        symb_state = layer_parameters.setdefault("symbologyState", {})

        if isinstance(renderer, QgsSingleSymbolRenderer):
            symbol = renderer.symbol()
            symb_state["renderType"] = "Single Symbol"

        elif isinstance(renderer, QgsCategorizedSymbolRenderer):
            field_name = renderer.classAttribute()
            cat_symbol = None
            for category in renderer.categories():
                cat_symbol = category.symbol()

            symb_state.update(
                renderType="Categorized",
                value=field_name,
                colorRamp="viridis",
                fallbackColor=[0.0, 0.0, 0.0, 0.0],
            )

            if cat_symbol is not None:
                outline_color_str = (
                    cat_symbol.symbolLayer(0)
                    .properties()
                    .get("outline_color", "0,0,0,255")
                )
                stroke_rgba = hex_to_rgba(rgb_to_hex(outline_color_str))
                symb_state["strokeColor"] = list(stroke_rgba)

                if isinstance(cat_symbol, QgsMarkerSymbol):
                    symb_state["geometryType"] = "circle"
                elif isinstance(cat_symbol, QgsLineSymbol):
                    props = cat_symbol.symbolLayer(0).properties()
                    symb_state["geometryType"] = "line"
                    symb_state["capStyle"] = props.get("capstyle", "round")
                    symb_state["joinStyle"] = props.get("joinstyle", "round")
                    symb_state["strokeWidth"] = float(props.get("line_width", 1.25))
                elif isinstance(cat_symbol, QgsFillSymbol):
                    symb_state["geometryType"] = "fill"

        elif isinstance(renderer, QgsGraduatedSymbolRenderer):
            field_name = renderer.classAttribute()
            range_symbol = None
            for rng in renderer.ranges():
                range_symbol = rng.symbol()

            n_classes = len(renderer.ranges()) or 9

            symb_state.update(
                renderType="Graduated",
                value=field_name,
                colorRamp="viridis",
                nClasses=n_classes,
                mode="equal interval",
            )

            if range_symbol is not None:
                if isinstance(range_symbol, QgsMarkerSymbol):
                    outline_color_str = (
                        range_symbol.symbolLayer(0)
                        .properties()
                        .get("outline_color", "0,0,0,255")
                    )
                    stroke_rgba = hex_to_rgba(rgb_to_hex(outline_color_str))
                    symb_state["strokeColor"] = list(stroke_rgba)
                    symb_state["geometryType"] = "circle"
                elif isinstance(range_symbol, QgsLineSymbol):
                    props = range_symbol.symbolLayer(0).properties()
                    symb_state["geometryType"] = "line"
                    symb_state["capStyle"] = props.get("capstyle", "round")
                    symb_state["joinStyle"] = props.get("joinstyle", "round")
                    symb_state["strokeWidth"] = float(props.get("line_width", 1.25))
                elif isinstance(range_symbol, QgsFillSymbol):
                    outline_color_str = (
                        range_symbol.symbolLayer(0)
                        .properties()
                        .get("outline_color", "0,0,0,255")
                    )
                    stroke_rgba = hex_to_rgba(rgb_to_hex(outline_color_str))
                    symb_state["strokeColor"] = list(stroke_rgba)
                    symb_state["geometryType"] = "fill"

        if symbol:
            r, g, b, a = hex_to_rgba(symbol.color().name())
            fill_color = [r, g, b, a]

            if isinstance(symbol, QgsMarkerSymbol):
                symb_state["fillColor"] = fill_color
                symb_state["strokeColor"] = fill_color
                symb_state["geometryType"] = "circle"

            elif isinstance(symbol, QgsLineSymbol):
                props = symbol.symbolLayer(0).properties()
                symb_state["strokeColor"] = fill_color
                symb_state["geometryType"] = "line"
                symb_state["capStyle"] = props.get("capstyle", "round")
                symb_state["joinStyle"] = props.get("joinstyle", "round")
                symb_state["strokeWidth"] = float(props.get("line_width", 1.25))

            elif isinstance(symbol, QgsFillSymbol):
                symb_state["fillColor"] = fill_color
                outline_color_str = (
                    symbol.symbolLayer(0).properties().get("outline_color", "0,0,0,255")
                )
                stroke_rgba = hex_to_rgba(rgb_to_hex(outline_color_str))
                symb_state["strokeColor"] = list(stroke_rgba)
                symb_state["geometryType"] = "fill"

        # Override with stored custom properties (survive round-trip without data).
        jgis_geom_type = layer.customProperty(PROP_GEOMETRY_TYPE)
        if jgis_geom_type:
            symb_state["geometryType"] = jgis_geom_type

        jgis_stroke_color = layer.customProperty(PROP_STROKE_COLOR)
        if jgis_stroke_color:
            symb_state["strokeColor"] = json.loads(jgis_stroke_color)

        jgis_cap_style = layer.customProperty(PROP_CAP_STYLE)
        if jgis_cap_style:
            symb_state["capStyle"] = jgis_cap_style

        jgis_join_style = layer.customProperty(PROP_JOIN_STYLE)
        if jgis_join_style:
            symb_state["joinStyle"] = jgis_join_style

        jgis_stroke_width = layer.customProperty(PROP_STROKE_WIDTH)
        if jgis_stroke_width is not None:
            symb_state["strokeWidth"] = float(jgis_stroke_width)

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
        return None

    layer_id = layer.id()

    if settings:
        layerSourceMap = settings.value("layerSourceMap", {})
        source_id = layerSourceMap.get(layer_id, {}).get("source_id", str(uuid4()))
        source_name = layerSourceMap.get(layer_id, {}).get(
            "source_name",
            f"{layer_name} Source",
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
            ],
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
        ],
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
                "visible": child.isVisible(),
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


def _rgba_to_qcolor(rgba):
    """Convert an [r,g,b,a] list (a in 0-1) to QColor."""
    if isinstance(rgba, str) and rgba.startswith("#"):
        r, g, b, a = hex_to_rgba(rgba)
        return QColor(int(r), int(g), int(b), int(a * 255))
    if isinstance(rgba, list) and len(rgba) == 4:
        r, g, b, a = rgba
        return QColor(int(r), int(g), int(b), int(a * 255))
    return QColor(0, 0, 0, 255)


def get_base_symbol(geometry_type, symb_state, opacity):
    """Returns a base symbol based on geometry type, reading from symbologyState."""
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

    stroke_color = _rgba_to_qcolor(symb_state.get("strokeColor", [0, 0, 0, 1]))
    stroke_width = symb_state.get("strokeWidth", 1.25)

    if geometry_type == "circle":
        symbol_layer.setStrokeColor(stroke_color)
        symbol_layer.setStrokeWidth(stroke_width)
    elif geometry_type == "line":
        symbol_layer.setWidth(float(stroke_width))
    elif geometry_type == "fill":
        symbol_layer.setStrokeColor(stroke_color)
        symbol_layer.setStrokeWidth(stroke_width)

    return symbol


def _build_color_ramp(symbology_state):
    """Build a QgsGradientColorRamp from the symbologyState colorRamp/reverseRamp fields.

    Uses the shared ``jupytergis_core.color_ramps`` module (backed by branca)
    to resolve the frontend ramp name and sample the start/end colours.
    """
    ramp_name = symbology_state.get("colorRamp", "viridis")
    reverse = symbology_state.get("reverseRamp", False)

    endpoints = sample_colors(ramp_name, n=2, reverse=reverse)
    c1 = QColor(*endpoints[0])
    c2 = QColor(*endpoints[1])

    return QgsGradientColorRamp(c1, c2)


def _sample_qcolors(symbology_state, n):
    """Sample *n* QColors from the ramp specified in symbologyState."""
    ramp_name = symbology_state.get("colorRamp", "viridis")
    reverse = symbology_state.get("reverseRamp", False)

    return [QColor(*rgba) for rgba in sample_colors(ramp_name, n=n, reverse=reverse)]


# Map jGIS classification mode names to QgsGraduatedSymbolRenderer method constants.
_GRADUATED_MODE_MAP = {
    "equal interval": 0,  # EqualInterval
    "quantile": 1,  # Quantile
    "jenks": 2,  # Jenks
    "pretty": 4,  # Pretty
    "logarithmic": 3,  # StdDev (closest match)
}


def create_categorized_renderer(symbology_state, geometry_type, base_symbol, map_layer):
    """Creates a categorized renderer by computing categories from the layer data.

    If stopsOverride is present, uses those custom stops instead of computing from data.
    """
    field_name = symbology_state.get("value")
    renderer = QgsCategorizedSymbolRenderer(field_name)
    stops_override = symbology_state.get("stopsOverride")

    if stops_override:
        for stop in stops_override:
            value = stop.get("value")
            rgba = stop.get("color", [0, 0, 0, 1])
            category_symbol = base_symbol.clone()
            category_symbol.setColor(_rgba_to_qcolor(rgba))
            if geometry_type == "circle":
                category_symbol.setSize(2 * symbology_state.get("radius", 5))
            renderer.addCategory(
                QgsRendererCategory(value, category_symbol, str(value)),
            )
    else:
        idx = map_layer.fields().indexOf(field_name) if map_layer else -1
        unique_values = sorted(map_layer.uniqueValues(idx)) if idx >= 0 else []
        n = len(unique_values)
        colors = _sample_qcolors(symbology_state, max(n, 1))

        for i, value in enumerate(unique_values):
            category_symbol = base_symbol.clone()
            category_symbol.setColor(colors[i])
            if geometry_type == "circle":
                category_symbol.setSize(2 * symbology_state.get("radius", 5))
            renderer.addCategory(
                QgsRendererCategory(value, category_symbol, str(value)),
            )

    return renderer


def create_graduated_renderer(symbology_state, geometry_type, base_symbol, map_layer):
    """Creates a graduated renderer by computing classification breaks from the layer data.

    If stopsOverride is present, uses those custom stops instead of computing from data.
    """
    field_name = symbology_state.get("value")
    n_classes = symbology_state.get("nClasses", 9)

    renderer = QgsGraduatedSymbolRenderer(field_name)
    renderer.setSourceSymbol(base_symbol.clone())

    color_ramp = _build_color_ramp(symbology_state)
    renderer.setSourceColorRamp(color_ramp)

    stops_override = symbology_state.get("stopsOverride")
    if stops_override:
        from qgis.core import QgsRendererRange  # type: ignore[import-untyped]

        for i, stop in enumerate(stops_override):
            rgba = stop.get("color", [0, 0, 0, 1])
            upper = stop.get("value", 0)
            lower = stops_override[i - 1].get("value", 0) if i > 0 else 0
            range_symbol = base_symbol.clone()
            range_symbol.setColor(_rgba_to_qcolor(rgba))
            renderer.addClassRange(
                QgsRendererRange(lower, upper, range_symbol, f"{lower} - {upper}"),
            )
    elif map_layer:
        mode = symbology_state.get("mode", "equal interval")
        qgis_mode = _GRADUATED_MODE_MAP.get(mode, 0)
        renderer.updateClasses(map_layer, qgis_mode, n_classes)

    return renderer


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
        zmax = parameters.get("maxZoom")
        zmin = parameters.get("minZoom", 0)

        if source_type in ["RasterSource", "VectorTileSource"]:
            url = parameters.get("url")
            if url is None:
                return None
            urlParameters = parameters.get("urlParameters")
            if urlParameters:
                for k, v in urlParameters.items():
                    url = url.replace(f"{{{k}}}", v)
            layer_config["url"] = url
            layer_config["type"] = "xyz"

        if source_type == "GeoJSONSource":
            path = parameters.get("path")
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

    layer = layers.get(layer_id)
    if layer is None:
        logs["warnings"].append(
            f"Layer {layer_id} not exported: the layer {layer_id} is not in layer list",
        )
        return None
    source_id = layer.get("parameters", {}).get("source", "")
    source = sources.get(source_id)
    if source is None:
        logs["warnings"].append(
            f"Layer {layer_id} not exported: the source {source_id} is not in source list",
        )
        return None

    map_layer = None

    layer_name = layer.get("name", "")
    layer_type = layer.get("type", None)
    source_type = source.get("type", None)
    if any([v is None for v in [layer_name, layer_type, source_type]]):
        logs["warnings"].append(
            f"Layer {layer_id} not exported: at least one of layer name, layer type or source type is missing.",
        )
        return None

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
                f"Layer {layer_id} not exported: invalid GeoJSON source.",
            )
            return None

        # Not checking for file.isValid() since it will eventually fail to load the file (relative path on the original file does not match server root)
        map_layer = QgsVectorLayer(uri, layer_name, "ogr")
        crs_84 = QgsCoordinateReferenceSystem("EPSG:4326")
        map_layer.setCrs(crs_84)

        layer_params = layer.get("parameters", {})
        symbology_state = layer_params.get("symbologyState", {})
        geometry_type = symbology_state.get("geometryType") or layer_params.get("type")

        # Infer geometry type from the QGIS layer when not set in jGIS data
        if not geometry_type and map_layer and map_layer.isValid():
            qgis_geom = map_layer.geometryType()
            geom_map = {
                Qgis.GeometryType.Point: "circle",
                Qgis.GeometryType.Line: "line",
                Qgis.GeometryType.Polygon: "fill",
            }
            geometry_type = geom_map.get(qgis_geom)

        # infer from symbologyState fields
        if not geometry_type:
            if symbology_state.get("radius") is not None:
                geometry_type = "circle"
            elif symbology_state.get("fillColor") is not None:
                geometry_type = "fill"
            else:
                geometry_type = "line"

        opacity = layer_params.get("opacity", 1.0)
        render_type = symbology_state.get("renderType", "Single Symbol")

        symbol = get_base_symbol(geometry_type, symbology_state, opacity)

        if symbol is None:
            logs["warnings"].append(
                f"Layer {layer_id} not exported: unknown geometry type '{geometry_type}'.",
            )
            return None

        if render_type == "Single Symbol":
            fill_color = _rgba_to_qcolor(
                symbology_state.get("fillColor", [51, 153, 204, 1]),
            )
            symbol.setColor(fill_color)

            if geometry_type == "circle":
                radius = symbology_state.get("radius", 5)
                symbol.setSize(2 * radius)
            elif geometry_type == "fill":
                stroke_color = _rgba_to_qcolor(
                    symbology_state.get("strokeColor", [0, 0, 0, 1]),
                )
                symbol_layer = symbol.symbolLayer(0)
                symbol_layer.setStrokeColor(stroke_color)

            renderer = QgsSingleSymbolRenderer(symbol)

        elif render_type == "Categorized":
            renderer = create_categorized_renderer(
                symbology_state,
                geometry_type,
                symbol,
                map_layer,
            )

        elif render_type == "Graduated":
            renderer = create_graduated_renderer(
                symbology_state,
                geometry_type,
                symbol,
                map_layer,
            )

        map_layer.setRenderer(renderer)

        # Store symbology metadata as custom properties so they survive
        # round-trip even when remote data can't be loaded in the target env.
        if geometry_type:
            map_layer.setCustomProperty(PROP_GEOMETRY_TYPE, geometry_type)
        stroke_color = symbology_state.get("strokeColor")
        if stroke_color is not None:
            map_layer.setCustomProperty(PROP_STROKE_COLOR, json.dumps(stroke_color))
        cap_style = symbology_state.get("capStyle")
        if cap_style is not None:
            map_layer.setCustomProperty(PROP_CAP_STYLE, cap_style)
        join_style = symbology_state.get("joinStyle")
        if join_style is not None:
            map_layer.setCustomProperty(PROP_JOIN_STYLE, join_style)
        stroke_width = symbology_state.get("strokeWidth")
        if stroke_width is not None:
            map_layer.setCustomProperty(PROP_STROKE_WIDTH, stroke_width)

    if layer_type == "GeoTiffLayer" and source_type == "GeoTiffSource":
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

            # skip the last value in both cases, that's the fallback and not used by qgis
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
            f"Layer {layer_id} not exported: enable to export layer type {layer_type}",
        )
        print(f"JUPYTERGIS - Unable to export layer type {layer_type}")
        return None

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
    path: str | Path,
    virtual_file: dict[str, Any],
) -> dict[str, list[str]]:
    if not all(k in virtual_file for k in ["layers", "sources", "layerTree"]):
        return None

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
                    QgsRectangle(*extent),
                    QgsCoordinateReferenceSystem(src_csr_id),
                ),
            )
        else:
            logs["warnings"].append(
                "The 'extent' parameter is missing to save the viewport",
            )
            print("The 'extent' parameter is missing to save the viewport")

    if not project.write(path):
        logs["errors"].append(f"Error when saving the file {path}")
    return logs
