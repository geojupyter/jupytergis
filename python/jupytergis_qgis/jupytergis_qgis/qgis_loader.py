from __future__ import annotations

import atexit
import os
import sys
from pathlib import Path
from typing import Any
from urllib.parse import unquote
from uuid import uuid4

from jupytergis_core.colors import hex_to_rgba, rgb_to_hex
from PyQt5.QtGui import QColor
from qgis.core import (  # type: ignore[import-untyped]
    Qgis,
    QgsApplication,
    QgsCategorizedSymbolRenderer,
    QgsCoordinateReferenceSystem,
    QgsDataSourceUri,
    QgsFillSymbol,
    QgsGraduatedSymbolRenderer,
    QgsHeatmapRenderer,
    QgsLayerTreeGroup,
    QgsLayerTreeLayer,
    QgsLineSymbol,
    QgsMapLayer,
    QgsMarkerSymbol,
    QgsPointClusterRenderer,
    QgsProject,
    QgsRasterLayer,
    QgsRectangle,
    QgsReferencedRectangle,
    QgsRuleBasedRenderer,
    QgsSettings,
    QgsSingleSymbolRenderer,
    QgsVectorLayer,
    QgsVectorTileLayer,
)

from .grammar import (
    _DEFAULT_FILL,
    _DEFAULT_RADIUS,
    _DEFAULT_STROKE,
    _DEFAULT_STROKE_WIDTH,
    categorized_grammar,
    cluster_grammar,
    combine_subsets,
    filters_to_subset,
    flat_colors_to_grammar,
    graduated_grammar,
    grammar_layer_alpha_factor,
    grammar_layer_geometry_hint,
    grammar_layer_subset,
    grammar_layer_to_renderer,
    grammar_to_flat_colors,
    grammar_to_raster_renderer,
    kde_grammar,
    raster_to_grammar,
    single_symbol_grammar,
    subset_to_when,
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


def _extract_symbol_style(symbol):
    """Pull (fill, stroke, stroke_width, radius, geometry_type) from a QGIS symbol.

    Colors are returned as grammar [r, g, b, a] lists (a in 0-1). The geometry
    type is informational only — grammar is geometry-agnostic, so export
    re-infers it from the data.
    """
    fill = list(_DEFAULT_FILL)
    stroke = list(_DEFAULT_STROKE)
    stroke_width = _DEFAULT_STROKE_WIDTH
    radius = _DEFAULT_RADIUS
    geometry_type = "fill"

    if symbol is None:
        return fill, stroke, stroke_width, radius, geometry_type

    color = list(hex_to_rgba(symbol.color().name()))
    symbol_layer = symbol.symbolLayer(0)
    props = symbol_layer.properties() if symbol_layer is not None else {}

    outline_color_str = props.get("outline_color")
    outline_stroke = (
        list(hex_to_rgba(rgb_to_hex(outline_color_str))) if outline_color_str else None
    )

    if isinstance(symbol, QgsMarkerSymbol):
        geometry_type = "circle"
        fill = color
        stroke = outline_stroke if outline_stroke is not None else color
        radius = symbol.size() / 2
    elif isinstance(symbol, QgsLineSymbol):
        geometry_type = "line"
        stroke = color
        stroke_width = float(props.get("line_width", _DEFAULT_STROKE_WIDTH))
    elif isinstance(symbol, QgsFillSymbol):
        geometry_type = "fill"
        fill = color
        if outline_stroke is not None:
            stroke = outline_stroke
        stroke_width = float(props.get("outline_width", _DEFAULT_STROKE_WIDTH))

    return fill, stroke, stroke_width, radius, geometry_type


def _heatmap_color_stops(renderer):
    """Sample a heatmap renderer's color ramp into 9 grammar colorStops over [0, 1]."""
    ramp = renderer.colorRamp()
    if ramp is None:
        return None
    n = 9
    return [
        {
            "stop": i / (n - 1),
            "color": [
                float(ramp.color(i / (n - 1)).red()),
                float(ramp.color(i / (n - 1)).green()),
                float(ramp.color(i / (n - 1)).blue()),
                float(ramp.color(i / (n - 1)).alpha()) / 255,
            ],
        }
        for i in range(n)
    ]


def _vector_renderer_to_grammar(renderer):
    """Convert a QGIS vector renderer to a Grammar symbologyState dict."""
    if isinstance(renderer, QgsHeatmapRenderer):
        weight_expr = renderer.weightExpression() or ""
        weight_field = weight_expr.strip().strip('"') or None
        return kde_grammar(
            renderer.radius(),
            weight_field,
            _heatmap_color_stops(renderer),
        )

    if isinstance(renderer, QgsPointClusterRenderer):
        embedded = renderer.embeddedRenderer()
        inner = (
            _vector_renderer_to_grammar(embedded)
            if embedded is not None
            else single_symbol_grammar(
                list(_DEFAULT_FILL),
                list(_DEFAULT_STROKE),
                _DEFAULT_STROKE_WIDTH,
                _DEFAULT_RADIUS,
            )
        )
        return cluster_grammar(inner, renderer.tolerance())

    if isinstance(renderer, QgsRuleBasedRenderer):
        # Best-effort: rebuild a single symbol from the first rule that has one.
        # The per-rule filter expressions are not parsed back into predicates.
        symbol = None
        for rule in renderer.rootRule().children():
            if rule.symbol() is not None:
                symbol = rule.symbol()
                break
        fill, stroke, stroke_width, radius, _ = _extract_symbol_style(symbol)
        return single_symbol_grammar(fill, stroke, stroke_width, radius)

    if isinstance(renderer, QgsCategorizedSymbolRenderer):
        field = renderer.classAttribute()
        symbol = None
        for category in renderer.categories():
            symbol = category.symbol()
        _, stroke, stroke_width, radius, _ = _extract_symbol_style(symbol)
        return categorized_grammar(field, "viridis", stroke, stroke_width, radius)

    if isinstance(renderer, QgsGraduatedSymbolRenderer):
        field = renderer.classAttribute()
        symbol = None
        for class_range in renderer.ranges():
            symbol = class_range.symbol()
        n_classes = len(renderer.ranges()) or 9
        _, stroke, stroke_width, radius, _ = _extract_symbol_style(symbol)
        return graduated_grammar(
            field,
            "viridis",
            n_classes,
            "equal interval",
            stroke,
            stroke_width,
            radius,
        )

    # Single Symbol — and any unrecognised renderer falls back to its symbol.
    symbol = (
        renderer.symbol() if isinstance(renderer, QgsSingleSymbolRenderer) else None
    )
    fill, stroke, stroke_width, radius, _ = _extract_symbol_style(symbol)
    return single_symbol_grammar(fill, stroke, stroke_width, radius)


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

            # Read the pseudocolor renderer and express it as Grammar
            # (symbologyState.layers). The colour ramp is the single source of
            # truth post #1390; no OpenLayers `color` array is persisted.
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

            source_parameters.update(urls=urls, normalize=True, wrapX=True)
            layer_parameters["symbologyState"] = raster_to_grammar(
                colorList,
                band,
                source_min,
                source_max,
            )

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

        # OGR data sources look like "path|subset=...|layername=...". Split the
        # data path off the provider options (the "|subset=" we add on export
        # would otherwise be glued onto the GeoJSON URL/path).
        source = layer.source()
        path_part = source.split("|", 1)[0]
        if path_part.startswith("http://") or path_part.startswith("https://"):
            file_name = path_part
        else:
            file_name = path_part.split("/")[-1]

        source_parameters.update(path=file_name)

        renderer = layer.renderer()

        # Express the QGIS renderer as Grammar (symbologyState.layers), the single
        # source of truth post #1390. Single Symbol / Categorized / Graduated map
        # cleanly; anything else falls back to a default single symbol.
        symbology_state = _vector_renderer_to_grammar(renderer)

        # Translate the OGR subset string back into a layer-level grammar `when`
        # so feature filters survive the round-trip (best-effort: simple filters).
        when = subset_to_when(layer.subsetString())
        if when:
            for grammar_layer in symbology_state.get("layers", []):
                grammar_layer["when"] = when

        layer_parameters["symbologyState"] = symbology_state

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
        colors: dict[str, list] = {}

        for style in styles:
            symbol = style.symbol()
            geometry_type = style.geometryType()

            rgba = list(hex_to_rgba(symbol.color().name()))
            rgba[3] = symbol.opacity()

            # 0 = points, 1 = lines, 2 = polygons
            if geometry_type == 0:
                colors["circle-fill-color"] = rgba
                colors["circle-stroke-color"] = list(rgba)
            if geometry_type == 1:
                colors["stroke-color"] = rgba
            if geometry_type == 2:
                colors["fill-color"] = rgba

        layer_parameters["symbologyState"] = flat_colors_to_grammar(colors)

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


def jgis_layer_to_qgis(
    layer_id: str,
    layers: dict[str, dict[str, Any]],
    sources: dict[str, dict[str, Any]],
    settings: QgsSettings,
    logs: dict[str, list[str]],
) -> list[QgsMapLayer]:
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
        return []
    source_id = layer.get("parameters", {}).get("source", "")
    source = sources.get(source_id)
    if source is None:
        logs["warnings"].append(
            f"Layer {layer_id} not exported: the source {source_id} is not in source list",
        )
        return []

    map_layers: list[QgsMapLayer] = []
    # Per-layer opacity, parallel to map_layers (a Grammar layer's constant
    # pixel/fill alpha folds into the QGIS layer opacity).
    layer_opacities: list[float] = []

    layer_name = layer.get("name", "")
    layer_type = layer.get("type", None)
    source_type = source.get("type", None)
    if any([v is None for v in [layer_name, layer_type, source_type]]):
        logs["warnings"].append(
            f"Layer {layer_id} not exported: at least one of layer name, layer type or source type is missing.",
        )
        return []

    if layer_type == "OpenEOTileLayer":
        logs["warnings"].append(
            f"Layer {layer_id} not exported: OpenEO Tile layers not supported for export yet.",
        )
        return []

    layer_params = layer.get("parameters", {})
    opacity = layer_params.get("opacity", 1.0)

    if layer_type == "RasterLayer" and source_type == "RasterSource":
        source_parameters = source.get("parameters", {})
        uri = build_uri(source_parameters, "RasterSource")
        map_layers.append(QgsRasterLayer(uri, layer_name, "wms"))
        layer_opacities.append(opacity)

    elif layer_type == "VectorTileLayer" and source_type == "VectorTileSource":
        source_parameters = source.get("parameters", {})
        symbology_state = layer_params.get("symbologyState", {})
        # Pull the constant per-channel colours out of the Grammar.
        color_params = grammar_to_flat_colors(symbology_state)
        uri = build_uri(source_parameters, "VectorTileSource")

        map_layer = QgsVectorTileLayer(uri, layer_name)
        renderer = map_layer.renderer()
        styles = renderer.styles()
        parsed_styles = []

        def _apply(symbol, rgba):
            symbol.setColor(QColor(int(rgba[0]), int(rgba[1]), int(rgba[2])))
            symbol.setOpacity(rgba[3])

        if color_params:
            for style in styles:
                symbol = style.symbol()
                geometry_type = style.geometryType()
                # 0 = points, 1 = lines, 2 = polygons
                if geometry_type == 0 and "circle-fill-color" in color_params:
                    _apply(symbol, color_params["circle-fill-color"])
                if geometry_type == 1 and "stroke-color" in color_params:
                    _apply(symbol, color_params["stroke-color"])
                if geometry_type == 2 and "fill-color" in color_params:
                    _apply(symbol, color_params["fill-color"])
                parsed_styles.append(style)

            renderer.setStyles(parsed_styles)

        map_layers.append(map_layer)
        layer_opacities.append(opacity)

    elif layer_type == "VectorLayer" and source_type == "GeoJSONSource":
        source_parameters = source.get("parameters", {})
        uri = build_uri(source_parameters, "GeoJSONSource")
        if not uri:
            logs["warnings"].append(
                f"Layer {layer_id} not exported: invalid GeoJSON source.",
            )
            return []

        symbology_state = layer_params.get("symbologyState", {})
        # One QGIS layer per Grammar rendering layer, all sharing the source —
        # this is how QGIS shows several renderings (e.g. points + heatmap) of
        # the same data. A layer with no grammar still gets a default symbol.
        grammar_layers = symbology_state.get("layers") or [{}]
        layer_filter_subset = filters_to_subset(layer.get("filters"))

        for grammar_layer in grammar_layers:
            # Not checking isValid(): remote data often can't load here, but the
            # renderer is still written to the project.
            vlayer = QgsVectorLayer(uri, layer_name, "ogr")
            vlayer.setCrs(QgsCoordinateReferenceSystem("EPSG:4326"))

            # Grammar is geometry-agnostic; infer geometry from the data.
            geometry_type = None
            if vlayer.isValid():
                geom_map = {
                    Qgis.GeometryType.Point: "circle",
                    Qgis.GeometryType.Line: "line",
                    Qgis.GeometryType.Polygon: "fill",
                }
                geometry_type = geom_map.get(vlayer.geometryType())
            if not geometry_type:
                geometry_type = grammar_layer_geometry_hint(grammar_layer) or "fill"

            renderer = grammar_layer_to_renderer(
                grammar_layer,
                geometry_type,
                opacity,
                vlayer,
                logs,
                layer_id,
            )
            if renderer is not None:
                vlayer.setRenderer(renderer)

            subset = combine_subsets(
                layer_filter_subset,
                grammar_layer_subset(grammar_layer),
            )
            if subset:
                vlayer.setSubsetString(subset)

            map_layers.append(vlayer)
            layer_opacities.append(opacity * grammar_layer_alpha_factor(grammar_layer))

    elif layer_type == "GeoTiffLayer" and source_type == "GeoTiffSource":
        source_parameters = source.get("parameters", {})
        # TODO: Support sources with multiple URLs
        url = "/vsicurl/" + source_parameters["urls"][0]["url"]
        map_layer = QgsRasterLayer(url, layer_name, "gdal")

        symbology_state = layer_params.get("symbologyState", {})
        result = grammar_to_raster_renderer(
            symbology_state,
            map_layer.dataProvider(),
            logs,
            layer_id,
        )
        if result is not None:
            renderer, _, _ = result
            map_layer.setRenderer(renderer)

        map_layers.append(map_layer)
        layer_opacities.append(opacity)

    if not map_layers:
        logs["warnings"].append(
            f"Layer {layer_id} not exported: enable to export layer type {layer_type}",
        )
        print(f"JUPYTERGIS - Unable to export layer type {layer_type}")
        return []

    # Assign ids / opacity / source map. The first layer keeps the jGIS layer id
    # (so single-layer projects round-trip); extras get a suffixed id but share
    # the same source entry.
    layerSourceMap = settings.value("layerSourceMap", {})
    source_name = source.get("name", f"{layer_name} Source")
    for index, map_layer in enumerate(map_layers):
        map_layer_id = layer_id if index == 0 else f"{layer_id}::{index}"
        map_layer.setId(map_layer_id)
        map_layer.setOpacity(layer_opacities[index])
        layerSourceMap[map_layer_id] = {
            "source_id": source_id,
            "source_name": source_name,
        }
    settings.setValue("layerSourceMap", layerSourceMap)

    return map_layers


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
            # Item is a layer id — may expand to several QGIS layers (one per
            # Grammar rendering layer) sharing the same source.
            qgis_layers = jgis_layer_to_qgis(item, layers, sources, settings, logs)
            for qgis_layer in qgis_layers:
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
