from __future__ import annotations

import atexit
import math
import os
import re
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
    QgsCoordinateReferenceSystem,
    QgsDataSourceUri,
    QgsExpression,
    QgsExpressionNodeBinaryOperator,
    QgsExpressionNodeColumnRef,
    QgsExpressionNodeFunction,
    QgsExpressionNodeLiteral,
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

from .data_defined import dd_symbol_to_grammar, grammar_layer_to_renderer
from .grammar import (
    _DEFAULT_FILL,
    _DEFAULT_RADIUS,
    _DEFAULT_STROKE,
    _DEFAULT_STROKE_WIDTH,
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
    # .name() is "#rrggbb" and drops alpha; keep the real alpha so a transparent
    # (e.g. stroke-only) fill round-trips instead of coming back opaque.
    color[3] = symbol.color().alphaF()
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
        stroke_width = float(props.get("outline_width", _DEFAULT_STROKE_WIDTH))
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
    if geom == 2:  # polygon
        symbol = QgsFillSymbol()
        symbol_layer = symbol.symbolLayer(0)
        if fill is not None:
            symbol.setColor(_vt_qcolor(fill))
        if stroke is not None:
            symbol_layer.setStrokeColor(_vt_qcolor(stroke))
        else:
            symbol_layer.setStrokeStyle(Qt.NoPen)
    elif geom == 1:  # line — its single colour is the stroke (fall back to fill)
        symbol = QgsLineSymbol()
        color = stroke if stroke is not None else fill
        if color is not None:
            symbol.setColor(_vt_qcolor(color))
    elif geom == 0:  # point
        symbol = QgsMarkerSymbol()
        symbol_layer = symbol.symbolLayer(0)
        if fill is not None:
            symbol.setColor(_vt_qcolor(fill))
        if stroke is not None:
            symbol_layer.setStrokeColor(_vt_qcolor(stroke))
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
    """The primary colour of a vector-tile style as a grammar [r, g, b, a] list."""
    symbol = style.symbol()
    rgba = list(hex_to_rgba(symbol.color().name()))
    rgba[3] = symbol.opacity()
    return rgba


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
        return ("categorical", field, categories)
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


# Comparison operators QGIS uses in the rule/filter expressions it generates,
# mapped to the grammar `fieldCompare` operator strings.
_COMPARE_OPS = {
    QgsExpressionNodeBinaryOperator.boGT: ">",
    QgsExpressionNodeBinaryOperator.boLT: "<",
    QgsExpressionNodeBinaryOperator.boGE: ">=",
    QgsExpressionNodeBinaryOperator.boLE: "<=",
    QgsExpressionNodeBinaryOperator.boNE: "!=",
}


def _comparison_node(node):
    """(field, op, value) for a ``"field" <op> literal`` node, else None.

    Uses QGIS's own parsed AST — no string matching.
    """
    if (
        isinstance(node, QgsExpressionNodeBinaryOperator)
        and isinstance(node.opLeft(), QgsExpressionNodeColumnRef)
        and isinstance(node.opRight(), QgsExpressionNodeLiteral)
    ):
        return (node.opLeft().name(), node.op(), node.opRight().value())
    return None


def _classify_leaf_filter(expr: str):
    """Classify a class rule's filter as ('eq', field, value) / ('range', ...).

    QGIS emits ``"field" = v`` for categories and ``"field" >= lo AND "field"
    <(=) hi`` for graduated ranges; anything else returns None.
    """
    parsed = QgsExpression(expr or "")
    if parsed.hasParserError() or parsed.rootNode() is None:
        return None
    node = parsed.rootNode()

    single = _comparison_node(node)
    if single and single[1] == QgsExpressionNodeBinaryOperator.boEQ:
        return ("eq", single[0], single[2])

    if (
        isinstance(node, QgsExpressionNodeBinaryOperator)
        and node.op() == QgsExpressionNodeBinaryOperator.boAnd
    ):
        lo = _comparison_node(node.opLeft())
        hi = _comparison_node(node.opRight())
        if (
            lo
            and hi
            and lo[0] == hi[0]
            and lo[1]
            in (
                QgsExpressionNodeBinaryOperator.boGE,
                QgsExpressionNodeBinaryOperator.boGT,
            )
            and hi[1]
            in (
                QgsExpressionNodeBinaryOperator.boLE,
                QgsExpressionNodeBinaryOperator.boLT,
            )
        ):
            return ("range", lo[0], float(lo[2]), float(hi[2]))
    return None


def _node_to_predicate(node):
    """One grammar `when` predicate from a parsed comparison/function node."""
    # geometry_type($geometry) = 'Point'
    if (
        isinstance(node, QgsExpressionNodeBinaryOperator)
        and node.op() == QgsExpressionNodeBinaryOperator.boEQ
        and isinstance(node.opLeft(), QgsExpressionNodeFunction)
        and isinstance(node.opRight(), QgsExpressionNodeLiteral)
    ):
        fn = QgsExpression.Functions()[node.opLeft().fnIndex()]
        if fn.name() == "geometry_type":
            qgis_to_grammar = {
                "Point": "Point",
                "Line": "LineString",
                "Polygon": "Polygon",
            }
            value = qgis_to_grammar.get(node.opRight().value())
            if value:
                return {"type": "geometryType", "value": value}

    cmp = _comparison_node(node)
    if cmp:
        field, op, value = cmp
        if op == QgsExpressionNodeBinaryOperator.boEQ:
            return {"type": "fieldEquals", "field": field, "value": value}
        if op in _COMPARE_OPS and isinstance(value, int | float):
            return {
                "type": "fieldCompare",
                "field": field,
                "op": _COMPARE_OPS[op],
                "value": value,
            }

    # range "field" >= lo AND "field" <= hi -> between
    classified = _classify_leaf_filter(node.dump())
    if classified and classified[0] == "range":
        return {
            "type": "between",
            "field": classified[1],
            "min": classified[2],
            "max": classified[3],
        }
    return None


def _expr_to_when(expr: str):
    """Parse a QGIS filter back into grammar `when` predicates + combinator.

    Handles the AND/OR-of-comparisons shape we emit; returns (None, None) when
    the expression isn't a clean set of predicates.
    """
    parsed = QgsExpression(expr or "")
    if parsed.hasParserError() or parsed.rootNode() is None:
        return None, None
    node = parsed.rootNode()

    # A bare range (field >= lo AND field <= hi) is a single `between` predicate.
    if _classify_leaf_filter(expr) and _classify_leaf_filter(expr)[0] == "range":
        predicate = _node_to_predicate(node)
        return ([predicate], "all") if predicate else (None, None)

    if isinstance(node, QgsExpressionNodeBinaryOperator) and node.op() in (
        QgsExpressionNodeBinaryOperator.boAnd,
        QgsExpressionNodeBinaryOperator.boOr,
    ):
        when_op = "any" if node.op() == QgsExpressionNodeBinaryOperator.boOr else "all"
        predicates = [
            _node_to_predicate(node.opLeft()),
            _node_to_predicate(node.opRight()),
        ]
        if all(predicates):
            return predicates, when_op
        return None, None

    predicate = _node_to_predicate(node)
    return ([predicate], "all") if predicate else (None, None)


def _scale_linear_args(node):
    """The 5 child nodes of a ``scale_linear(...)`` call inside ``node``, or None."""
    if isinstance(node, QgsExpressionNodeFunction):
        fn = QgsExpression.Functions()[node.fnIndex()]
        if fn.name() == "scale_linear":
            args = node.args().list()
            return args if len(args) == 5 else None
    if isinstance(node, QgsExpressionNodeBinaryOperator):
        return _scale_linear_args(node.opLeft()) or _scale_linear_args(node.opRight())
    return None


def _scalar_from_property(prop):
    """A grammar (field, domain, range) scalar from a ``scale_linear`` QgsProperty."""
    parsed = QgsExpression(prop.expressionString())
    if parsed.hasParserError() or parsed.rootNode() is None:
        return None
    args = _scale_linear_args(parsed.rootNode())
    if not args or not isinstance(args[0], QgsExpressionNodeColumnRef):
        return None
    field = args[0].name()
    try:
        d0, d1, r0, r1 = (float(a.value()) for a in args[1:])
    except (AttributeError, TypeError, ValueError):
        return None
    return field, [d0, d1], [r0, r1]


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


def _merge_data_defined_mappings(grammar, symbol):
    """Splice a symbol's data-defined channel mappings into a built grammar.

    Native graduated / categorized / single-symbol renderers carry data-driven
    radius and stroke as ``QgsProperty`` overrides on the symbol, but the
    ``*_grammar`` builders only emit constant mappings. Replace those constants
    with the recovered scalar / identity mappings (e.g. a data-driven
    circle-radius marker size) so the round-trip keeps the data-driven channel
    instead of flattening it to a constant.
    """
    extra, replaced, field = _data_defined_mappings(symbol)
    if extra:
        rule = grammar["layers"][0]["rules"][0]
        rule["mappings"] = [
            mapping
            for mapping in rule["mappings"]
            if not (set(mapping["channels"]) & replaced)
        ]
        rule["mappings"].extend(extra)
        if field and not rule.get("fields"):
            rule["fields"] = [field]
    return grammar


def _add_data_defined_rule(grammar, symbol):
    """Recover a symbol's data-defined channels into a *separate* grammar rule.

    For a classified renderer the first rule is keyed on the classification
    field, but a data-defined channel (e.g. a line width scaled from
    ``length_km`` while the colour is categorical on ``type``) is keyed on its
    own field. So drop the constants it supersedes from the colour rule and add
    the recovered mappings as a new rule carrying their own field, instead of
    merging them into the colour rule (which would re-key them on the wrong
    field).
    """
    extra, replaced, field = _data_defined_mappings(symbol)
    if not extra:
        return grammar
    layer = grammar["layers"][0]
    color_rule = layer["rules"][0]
    color_rule["mappings"] = [
        mapping
        for mapping in color_rule["mappings"]
        if not (set(mapping["channels"]) & replaced)
    ]
    rule = {"id": str(uuid4()), "mappings": extra}
    if field:
        rule["fields"] = [field]
    layer["rules"].append(rule)
    return grammar


def _vector_renderer_to_grammar(renderer):
    """Convert a QGIS vector renderer to a Grammar symbologyState dict.

    Heatmap and cluster renderers keep their dedicated translations; every other
    vector renderer is the data-defined single symbol that export now produces and
    is decoded by :func:`dd_symbol_to_grammar`.
    """
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
            else dd_symbol_to_grammar(None)
        )
        return cluster_grammar(inner, renderer.tolerance())

    symbol = (
        renderer.symbol() if isinstance(renderer, QgsSingleSymbolRenderer) else None
    )
    return dd_symbol_to_grammar(symbol)


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
        styles_by_geom: dict[int, list] = {}
        for style in renderer.styles():
            styles_by_geom.setdefault(int(style.geometryType()), []).append(style)
        # A line's colour is its "stroke"; polygons/points carry it as "fill".
        geom_styles = {
            geom: {("stroke" if geom == 1 else "fill"): _vt_reconstruct(styles)}
            for geom, styles in styles_by_geom.items()
        }
        layer_parameters["symbologyState"] = vector_tile_grammar(geom_styles)

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
