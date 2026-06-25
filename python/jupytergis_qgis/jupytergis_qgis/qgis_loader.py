from __future__ import annotations

import atexit
import json
import math
import os
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import unquote
from uuid import uuid4

from PyQt5.QtGui import QColor
from qgis.core import (  # type: ignore[import-untyped]
    Qgis,
    QgsApplication,
    QgsCoordinateReferenceSystem,
    QgsDataSourceUri,
    QgsExpression,
    QgsExpressionNodeBinaryOperator,
    QgsFillSymbol,
    QgsHeatmapRenderer,
    QgsLayerTreeGroup,
    QgsLayerTreeLayer,
    QgsLineSymbol,
    QgsMapLayer,
    QgsMarkerSymbol,
    QgsMultiBandColorRenderer,
    QgsPointClusterRenderer,
    QgsProject,
    QgsRasterBandStats,
    QgsRasterLayer,
    QgsRectangle,
    QgsReferencedRectangle,
    QgsSettings,
    QgsSingleBandGrayRenderer,
    QgsSingleBandPseudoColorRenderer,
    QgsSingleSymbolRenderer,
    QgsSymbolLayer,
    QgsVectorLayer,
    QgsVectorTileBasicRendererStyle,
    QgsVectorTileLayer,
)
from qgis.PyQt.QtCore import Qt

from .data_defined import (
    _RAMP_META_KEY,
    dd_symbol_to_grammar,
    grammar_layer_to_renderer,
)
from .grammar import (
    _comparison_node,
    _scalar_from_property,
    cluster_grammar,
    combine_subsets,
    filters_to_subset,
    grammar_layer_alpha_factor,
    grammar_layer_geometry_hint,
    grammar_layer_subset,
    grammar_to_raster_renderer,
    grammar_to_vector_tile_styles,
    grayscale_raster_to_grammar,
    kde_grammar,
    multiband_raster_to_grammar,
    raster_flat_color_to_grammar,
    raster_to_grammar,
    subset_to_when,
    vector_tile_grammar,
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


def _is_finite_number(value) -> bool:
    return isinstance(value, int | float) and math.isfinite(value)


def _raster_min_max(provider, band: int, enhancement) -> tuple[float, float]:
    """Numeric (min, max) for a GeoTiff source band, never None/NaN.

    GeoTiff sources require numeric min/max (used to normalize for display).
    Prefer QGIS's contrast-enhancement stretch, fall back to band statistics,
    then to a 0-255 default.
    """
    if enhancement is not None:
        lo, hi = enhancement.minimumValue(), enhancement.maximumValue()
        if _is_finite_number(lo) and _is_finite_number(hi) and lo != hi:
            return float(lo), float(hi)
    if provider is not None:
        stats = provider.bandStatistics(
            band,
            QgsRasterBandStats.Min | QgsRasterBandStats.Max,
        )
        lo, hi = stats.minimumValue, stats.maximumValue
        if _is_finite_number(lo) and _is_finite_number(hi) and lo != hi:
            return float(lo), float(hi)
    return 0.0, 255.0


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


def _vt_qcolor(rgba) -> QColor:
    """A QColor from a grammar [r, g, b, a] list (alpha 0-1)."""
    alpha = rgba[3] if len(rgba) > 3 else 1.0
    return QColor(int(rgba[0]), int(rgba[1]), int(rgba[2]), int(alpha * 255))


def _vt_spec_to_style(spec: dict, index: int):
    """Build one QgsVectorTileBasicRendererStyle from a grammar style spec."""
    geom = spec["geom"]
    fill = spec.get("fill")
    stroke = spec.get("stroke")
    width = spec.get("width")
    if geom == 2:  # polygon
        symbol = QgsFillSymbol()
        symbol_layer = symbol.symbolLayer(0)
        if fill is not None:
            symbol.setColor(_vt_qcolor(fill))
        if stroke is not None:
            symbol_layer.setStrokeColor(_vt_qcolor(stroke))
        else:
            symbol_layer.setStrokeStyle(Qt.NoPen)
        if width is not None:
            symbol_layer.setStrokeWidth(width)
    elif geom == 1:  # line — its single colour is the stroke (fall back to fill)
        symbol = QgsLineSymbol()
        symbol_layer = symbol.symbolLayer(0)
        color = stroke if stroke is not None else fill
        if color is not None:
            symbol.setColor(_vt_qcolor(color))
        if width is not None:
            symbol_layer.setWidth(width)
    elif geom == 0:  # point
        symbol = QgsMarkerSymbol()
        symbol_layer = symbol.symbolLayer(0)
        if fill is not None:
            symbol.setColor(_vt_qcolor(fill))
        if stroke is not None:
            symbol_layer.setStrokeColor(_vt_qcolor(stroke))
        if width is not None:
            symbol_layer.setStrokeWidth(width)
    else:
        return None

    geom_enum = {
        0: Qgis.GeometryType.Point,
        1: Qgis.GeometryType.Line,
        2: Qgis.GeometryType.Polygon,
    }[geom]
    style = QgsVectorTileBasicRendererStyle(f"class{index}", "", geom_enum)
    style.setSymbol(symbol)
    style.setFilterExpression(spec.get("filter") or "")
    style.setEnabled(True)
    return style


def _vt_style_color(style) -> list:
    """The primary colour of a vector-tile style as a grammar [r, g, b, a] list.

    Alpha rides on the symbol colour (``QColor.alphaF()``), not the symbol opacity
    -- the exporter writes the colour with its alpha baked in, so reading
    ``symbol.opacity()`` (always 1.0) dropped the transparency (e.g. a line stroke
    ``[0, 0, 0, 0.72]`` came back fully opaque).
    """
    color = style.symbol().color()
    return [color.red(), color.green(), color.blue(), color.alphaF()]


def _vt_style_width(style) -> float | None:
    """A vector-tile style's *explicit* constant stroke width, or None.

    A line's width is its own; a polygon/point width is its outline's, reported
    only when an outline is drawn (skips QGIS's default ``NoPen`` fills). A width
    equal to QGIS's default for that symbol is treated as unset, so the round trip
    doesn't invent a width row the source never had.
    """
    geom = int(style.geometryType())
    symbol_layer = style.symbol().symbolLayer(0)
    if geom == 1:  # line
        width = symbol_layer.width()
        fresh = QgsLineSymbol()
        default = fresh.symbolLayer(0).width()
        return width if width != default else None
    stroke_style = getattr(symbol_layer, "strokeStyle", None)
    if stroke_style is not None and stroke_style() == Qt.NoPen:
        return None
    stroke_width = getattr(symbol_layer, "strokeWidth", None)
    if stroke_width is None:
        return None
    width = stroke_width()
    fresh = QgsFillSymbol() if geom == 2 else QgsMarkerSymbol()
    default = fresh.symbolLayer(0).strokeWidth()
    return width if width != default else None


def _vt_parse_filter(expr: str):
    """Parse a class filter into ``('eq', value)`` / ``('range', lo, hi)``.

    Handles the class shapes the exporter writes: ``"f" = v`` (categorical),
    ``"f" < hi`` (first class), ``"f" >= lo AND "f" < hi`` (middle) and
    ``"f" >= lo`` (last); ``lo`` / ``hi`` may be None for an open end.
    """
    parsed = QgsExpression(expr or "")
    if parsed.hasParserError() or parsed.rootNode() is None:
        return None
    node = parsed.rootNode()
    single = _comparison_node(node)
    if single:
        _, op, value = single
        if op == QgsExpressionNodeBinaryOperator.boEQ:
            return ("eq", value)
        if op in (
            QgsExpressionNodeBinaryOperator.boLT,
            QgsExpressionNodeBinaryOperator.boLE,
        ):
            return ("range", None, float(value))
        if op in (
            QgsExpressionNodeBinaryOperator.boGT,
            QgsExpressionNodeBinaryOperator.boGE,
        ):
            return ("range", float(value), None)
    if (
        isinstance(node, QgsExpressionNodeBinaryOperator)
        and node.op() == QgsExpressionNodeBinaryOperator.boAnd
    ):
        left = _comparison_node(node.opLeft())
        right = _comparison_node(node.opRight())
        if left and right:
            lo = hi = None
            for _, op, value in (left, right):
                if op in (
                    QgsExpressionNodeBinaryOperator.boGT,
                    QgsExpressionNodeBinaryOperator.boGE,
                ):
                    lo = float(value)
                else:
                    hi = float(value)
            return ("range", lo, hi)
    return None


def _vt_reconstruct(styles) -> tuple:
    """Fold a geometry's class styles back into one colour instruction.

    A single unfiltered style is a constant; several filtered classes rebuild a
    colorRamp (range filters) or categorical (equality filters) on the field.
    """
    if len(styles) == 1 and not styles[0].filterExpression():
        return ("const", _vt_style_color(styles[0]))

    field = None
    ranges = []
    categories = []
    for style in styles:
        expr = style.filterExpression()
        match = re.search(r'"([^"]+)"', expr or "")
        if match:
            field = match.group(1)
        parsed = _vt_parse_filter(expr)
        color = _vt_style_color(style)
        if parsed and parsed[0] == "range":
            ranges.append((parsed[1], parsed[2], color))
        elif parsed and parsed[0] == "eq":
            categories.append({"stop": parsed[1], "color": color})

    if field and categories and not ranges:
        seen: set = set()
        unique = []
        for category in categories:
            key = str(category["stop"])
            if key not in seen:
                seen.add(key)
                unique.append(category)
        return ("categorical", field, unique)
    if field and ranges:
        # Order by lower bound (open first class sorts first); each class's stop is
        # its lower bound, so the ramp spans the recovered class breaks.
        ranges.sort(key=lambda item: (item[0] is not None, item[0]))
        stops = []
        for lo, hi, color in ranges:
            value = lo if lo is not None else hi
            if value is not None and (not stops or stops[-1]["stop"] != float(value)):
                stops.append({"stop": float(value), "color": color})
        if len(stops) >= 2:
            return ("colorRamp", field, stops)
    return ("const", _vt_style_color(styles[0]))


def _data_defined_mappings(symbol):
    """Grammar mappings for a symbol's data-defined overrides + the channels used.

    Reads ``QgsProperty`` objects straight off the symbol (field reference ->
    identity, ``scale_linear`` expression -> scalar); QGIS deserialised them, so
    there is no string parsing of static/field properties.
    """
    mappings: list[dict] = []
    channels_replaced: set[str] = set()
    field: str | None = None
    if symbol is None:
        return mappings, channels_replaced, field

    # Marker size (circle-radius); the diameter doubling is undone via the
    # scale_linear range carried in the expression.
    if isinstance(symbol, QgsMarkerSymbol):
        size_prop = symbol.dataDefinedSize()
        if (
            size_prop is not None
            and size_prop.isActive()
            and size_prop.expressionString()
        ):
            scalar = _scalar_from_property(size_prop)
            if scalar:
                field, domain, output_range = scalar
                mappings.append(
                    {
                        "scale": {
                            "scheme": "scalar",
                            "params": {
                                "domain": domain,
                                "range": output_range,
                                "mode": "equal interval",
                                "nStops": 5,
                                "fallback": 0.0,
                            },
                        },
                        "channels": ["circle-radius"],
                    },
                )
                channels_replaced.add("circle-radius")

    symbol_layer = symbol.symbolLayer(0)
    if symbol_layer is None:
        return mappings, channels_replaced, field

    collection = symbol_layer.dataDefinedProperties()
    stroke_prop = collection.property(QgsSymbolLayer.PropertyStrokeColor)
    if stroke_prop is not None and stroke_prop.isActive() and stroke_prop.field():
        field = field or stroke_prop.field()
        mappings.append(
            {
                "scale": {"scheme": "identity"},
                "channels": ["stroke-color", "circle-stroke-color"],
            },
        )
        channels_replaced.update({"stroke-color", "circle-stroke-color"})

    width_prop = collection.property(QgsSymbolLayer.PropertyStrokeWidth)
    if width_prop is not None and width_prop.isActive():
        if width_prop.field():
            field = field or width_prop.field()
            mappings.append(
                {
                    "scale": {"scheme": "identity"},
                    "channels": ["stroke-width", "circle-stroke-width"],
                },
            )
            channels_replaced.update({"stroke-width", "circle-stroke-width"})
        elif width_prop.expressionString():
            scalar = _scalar_from_property(width_prop)
            if scalar:
                field, domain, output_range = scalar
                mappings.append(
                    {
                        "scale": {
                            "scheme": "scalar",
                            "params": {
                                "domain": domain,
                                "range": output_range,
                                "mode": "equal interval",
                                "nStops": 5,
                                "fallback": 0.0,
                            },
                        },
                        "channels": ["stroke-width", "circle-stroke-width"],
                    },
                )
                channels_replaced.update({"stroke-width", "circle-stroke-width"})

    return mappings, channels_replaced, field


def _vector_renderer_to_grammar(renderer, ramp_meta=None):
    """Convert a QGIS vector renderer to a Grammar symbologyState dict.

    Heatmap and cluster renderers keep their dedicated translations; every other
    vector renderer is the data-defined single symbol that export now produces and
    is decoded by :func:`dd_symbol_to_grammar`. ``ramp_meta`` is the layer's stashed
    per-slot ramp identity so the named colour ramp survives the round-trip.
    """
    if isinstance(renderer, QgsHeatmapRenderer):
        weight_expr = renderer.weightExpression() or ""
        weight_field = weight_expr.strip().strip('"') or None
        heatmap = (ramp_meta or {}).get("heatmap") or {}
        return kde_grammar(
            renderer.radius(),
            weight_field,
            _heatmap_color_stops(renderer),
            heatmap.get("name"),
            bool(heatmap.get("reverse", False)),
        )

    if isinstance(renderer, QgsPointClusterRenderer):
        embedded = renderer.embeddedRenderer()
        inner = (
            _vector_renderer_to_grammar(embedded, ramp_meta)
            if embedded is not None
            else dd_symbol_to_grammar(None)
        )
        return cluster_grammar(inner, renderer.tolerance())

    symbol = (
        renderer.symbol() if isinstance(renderer, QgsSingleSymbolRenderer) else None
    )
    return dd_symbol_to_grammar(symbol, ramp_meta)


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

            # Express the renderer as Grammar (symbologyState.layers), the single
            # source of truth post #1390; no OpenLayers `color` array is persisted.
            renderer = layer.renderer()
            provider = layer.dataProvider()

            if isinstance(renderer, QgsMultiBandColorRenderer):
                # Multiband RGB -> pixel-red/green/blue band mappings. A band's
                # contrast stretch (if any) becomes a scalar rescale.
                bands = {
                    0: renderer.redBand(),
                    1: renderer.greenBand(),
                    2: renderer.blueBand(),
                }
                enhancements = {
                    0: renderer.redContrastEnhancement(),
                    1: renderer.greenContrastEnhancement(),
                    2: renderer.blueContrastEnhancement(),
                }
                ranges = {
                    index: (enhancement.minimumValue(), enhancement.maximumValue())
                    for index, enhancement in enhancements.items()
                    if enhancement is not None
                    and _is_finite_number(enhancement.minimumValue())
                    and _is_finite_number(enhancement.maximumValue())
                }
                # A dedicated alpha/mask band (renderer.alphaBand() is -1 when
                # unset) round-trips as a pixel-alpha mapping.
                alpha_band = renderer.alphaBand()
                layer_parameters["symbologyState"] = multiband_raster_to_grammar(
                    bands,
                    ranges,
                    alpha_band if alpha_band >= 1 else None,
                )
                source_min, source_max = _raster_min_max(
                    provider,
                    renderer.redBand(),
                    renderer.redContrastEnhancement(),
                )
            elif isinstance(renderer, QgsSingleBandPseudoColorRenderer):
                shaderFunc = renderer.shader().rasterShaderFunction()
                colorList = shaderFunc.colorRampItemList()
                band = renderer.band()
                source_min = renderer.classificationMin()
                source_max = renderer.classificationMax()
                if not (
                    _is_finite_number(source_min) and _is_finite_number(source_max)
                ):
                    source_min, source_max = _raster_min_max(provider, band, None)
                layer_parameters["symbologyState"] = raster_to_grammar(
                    colorList,
                    band,
                    source_min,
                    source_max,
                )
            elif isinstance(renderer, QgsSingleBandGrayRenderer):
                band = renderer.grayBand()
                source_min, source_max = _raster_min_max(
                    provider,
                    band,
                    renderer.contrastEnhancement(),
                )
                layer_parameters["symbologyState"] = grayscale_raster_to_grammar(band)
            else:
                # Unknown raster renderer: keep the layer with a default stretch.
                source_min, source_max = _raster_min_max(provider, 1, None)
                layer_parameters["symbologyState"] = {"layers": []}

            # Remove "/vsicurl/" from source
            source_parameters.update(
                urls=[
                    {
                        "url": layer.source()[9:],
                        "min": source_min,
                        "max": source_max,
                    },
                ],
                normalize=True,
                wrapX=True,
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
            # QGIS resolves layer sources to absolute paths. jGIS stores paths
            # relative to its document directory (same place the project lives),
            # so re-relativise to keep any subdirectory (e.g. "data/eq.geojson")
            # rather than collapsing to the bare basename. Only fall back to the
            # basename when the data sits outside the project tree, to avoid
            # emitting fragile "../" paths.
            project_dir = QgsProject.instance().absolutePath()
            src = Path(path_part)
            if project_dir and src.is_absolute():
                try:
                    file_name = str(src.relative_to(project_dir))
                except ValueError:
                    file_name = src.name
            else:
                file_name = path_part

        source_parameters.update(path=file_name)

        renderer = layer.renderer()

        # The named colour ramp baked into a data-defined CASE is recovered from the
        # layer custom property export stashed it under (the stops alone can't say
        # which ramp produced them).
        ramp_meta = {}
        raw_ramp_meta = layer.customProperty(_RAMP_META_KEY)
        if raw_ramp_meta:
            try:
                ramp_meta = json.loads(raw_ramp_meta)
            except (ValueError, TypeError):
                ramp_meta = {}

        # Express the QGIS renderer as Grammar (symbologyState.layers), the single
        # source of truth post #1390. Single Symbol / Categorized / Graduated map
        # cleanly; anything else falls back to a default single symbol.
        symbology_state = _vector_renderer_to_grammar(renderer, ramp_meta)

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
        styles_by_geom: dict[int, list] = {}
        for style in renderer.styles():
            styles_by_geom.setdefault(int(style.geometryType()), []).append(style)
        # A line's colour is its "stroke"; polygons/points carry it as "fill".
        geom_styles = {
            geom: {("stroke" if geom == 1 else "fill"): _vt_reconstruct(styles)}
            for geom, styles in styles_by_geom.items()
        }
        geom_widths = {
            geom: width
            for geom, styles in styles_by_geom.items()
            if (width := _vt_style_width(styles[0])) is not None
        }
        layer_parameters["symbologyState"] = vector_tile_grammar(
            geom_styles,
            geom_widths,
        )

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


# A jGIS layer with several renderings is exported as one QGIS layer per
# rendering, all sharing the data source; the extras get an "<id>::<n>" id
# (see jgis_layer_to_qgis). This matches "<base>::<index>" so import can fold
# them back into a single jGIS layer.
_MULTI_RENDER_ID_RE = re.compile(r"(?P<base>.+)::(?P<index>\d+)$")


def _prune_ids_from_tree(layer_tree: list, removed: set[str]) -> list:
    """Drop merged layer ids from the (possibly nested) layer tree."""
    pruned = []
    for item in layer_tree:
        if isinstance(item, str):
            if item not in removed:
                pruned.append(item)
        else:
            item["layers"] = _prune_ids_from_tree(item.get("layers", []), removed)
            pruned.append(item)
    return pruned


def _merge_multi_render_layers(jgis: dict[str, Any]) -> dict[str, Any]:
    """Recombine the "<id>::<n>" QGIS layers back into one jGIS layer whose
    symbologyState holds the several renderings (e.g. points + heatmap).
    """
    layers = jgis["layers"]

    # base id -> [(index, extra_id), ...]
    extras: dict[str, list[tuple[int, str]]] = {}
    for layer_id in layers:
        match = _MULTI_RENDER_ID_RE.fullmatch(layer_id)
        if match:
            extras.setdefault(match["base"], []).append(
                (int(match["index"]), layer_id),
            )

    removed: set[str] = set()
    for base_id, items in extras.items():
        base = layers.get(base_id)
        if base is None:
            # No base layer to merge into (e.g. it failed to import); leave the
            # extras as standalone layers rather than dropping them.
            continue
        base_grammar = (
            base.setdefault("parameters", {})
            .setdefault("symbologyState", {})
            .setdefault("layers", [])
        )
        for _, extra_id in sorted(items):
            extra = layers.pop(extra_id)
            removed.add(extra_id)
            base_grammar.extend(
                extra.get("parameters", {}).get("symbologyState", {}).get("layers", []),
            )

    if removed:
        jgis["layerTree"] = _prune_ids_from_tree(jgis["layerTree"], removed)
        # Drop sources no longer referenced by any surviving layer.
        used_sources = {
            layer.get("parameters", {}).get("source") for layer in layers.values()
        }
        jgis["sources"] = {
            source_id: source
            for source_id, source in jgis["sources"].items()
            if source_id in used_sources
        }

    return jgis


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
    jgis_layer_tree = _merge_multi_render_layers(jgis_layer_tree)

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
        # Each spec is one constant-colour style (a value-filtered class for a
        # colorRamp/categorical, or a single unfiltered style for a constant).
        # No data-defined colours: those do not load across QGIS versions.
        style_specs = grammar_to_vector_tile_styles(symbology_state, logs, layer_id)
        uri = build_uri(source_parameters, "VectorTileSource")

        map_layer = QgsVectorTileLayer(uri, layer_name)
        if style_specs:
            qgis_styles = [
                _vt_spec_to_style(spec, index) for index, spec in enumerate(style_specs)
            ]
            renderer = map_layer.renderer()
            renderer.setStyles([style for style in qgis_styles if style is not None])

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

            # Opacity is applied once, at the QGIS layer level (set below via
            # layer_opacities). Passing it into the renderer too would set symbol
            # opacity as well, and QGIS multiplies symbol x layer opacity -> the
            # effective opacity would be squared. Build symbols at full opacity.
            renderer = grammar_layer_to_renderer(
                grammar_layer,
                geometry_type,
                1.0,
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
        first_url = source_parameters["urls"][0]
        url = "/vsicurl/" + first_url["url"]
        map_layer = QgsRasterLayer(url, layer_name, "gdal")

        symbology_state = layer_params.get("symbologyState", {})
        # Legacy (pre-Grammar) GeoTiff layers keep their ramp in the OL `color`
        # expression rather than `symbologyState.layers`; migrate it so the ramp
        # exports instead of falling back to QGIS's default grayscale renderer.
        if not symbology_state.get("layers"):
            symbology_state = raster_flat_color_to_grammar(layer_params.get("color"))
        result = grammar_to_raster_renderer(
            symbology_state,
            map_layer.dataProvider(),
            logs,
            layer_id,
            first_url.get("min"),
            first_url.get("max"),
        )
        if result is not None:
            renderer, _, _ = result
            map_layer.setRenderer(renderer)

        map_layers.append(map_layer)
        layer_opacities.append(opacity)

    if layer_type == "GeoZarrLayer":
        logs["warnings"].append(
            f"Layer {layer_id} ({layer_name}) not exported: "
            "GeoZarr layers are not supported in QGIS.",
        )
        return []

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

    # Always rebuild the project from scratch: the JupyterGIS document is the
    # source of truth for layers, sources, CRS and extent. Reading an existing
    # .qgz back into the singleton project leaks stale state from it (e.g. a
    # heatmap's old colour ramp survives removeAllMapLayers()/clear() and
    # clobbers the freshly-built renderer on re-export over the same file).
    project = QgsProject.instance()
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
