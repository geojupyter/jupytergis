"""Data-defined vector symbology: Grammar <-> a single QGIS symbol.

A grammar rendering layer's colour / size / width channels are expressed as
QGIS *data-defined properties* (``QgsProperty``) on one ``QgsSingleSymbolRenderer``
symbol, instead of native graduated / categorized / rule-based renderers. This
keeps the translation to a single code path; the per-feature colour is computed
by QGIS from a ``CASE`` expression that round-trips across QGIS versions
(verified 3.40 -> 3.44 for regular vector layers).

Scope: vector (point / line / polygon) only. Raster, vector-tile, heatmap and
cluster have no data-defined equivalent and keep their dedicated renderers in
:mod:`grammar` and :mod:`qgis_loader`.
"""

from __future__ import annotations

from typing import Any

from jupytergis_core.color_ramps import sample_colors
from qgis.core import (  # type: ignore[import-untyped]
    QgsExpression,
    QgsExpressionNodeBinaryOperator,
    QgsExpressionNodeCondition,
    QgsExpressionNodeFunction,
    QgsExpressionNodeLiteral,
    QgsProperty,
    QgsSingleSymbolRenderer,
    QgsSymbolLayer,
)

from .grammar import (
    _DEFAULT_FILL,
    _FILL_CHANNELS,
    _STROKE_COLOR_CHANNELS,
    _TRANSPARENT,
    _cluster_renderer,
    _collect_vector_style,
    _heatmap_renderer,
    _make_base_symbol,
    _rgba_to_qcolor,
    _sql_literal,
    _when_to_expr,
    categorized_grammar,
    graduated_grammar,
    single_symbol_grammar,
)

# ---------------------------------------------------------------------------
# Colour-expression encoding (export)
# ---------------------------------------------------------------------------
_LT_OPS = (
    QgsExpressionNodeBinaryOperator.boLT,
    QgsExpressionNodeBinaryOperator.boLE,
)


def _color_rgba_literal(rgba: Any) -> str:
    """A QGIS ``color_rgba(r, g, b, a)`` literal from a grammar [r,g,b,a] (a 0-1)."""
    r, g, b = int(rgba[0]), int(rgba[1]), int(rgba[2])
    a = round((rgba[3] if len(rgba) > 3 else 1.0) * 255)
    return f"color_rgba({r}, {g}, {b}, {a})"


def _colorramp_case_expr(field: str, color_stops: list[dict]) -> str:
    """A ``CASE`` mapping each stop's upper bound to its colour (a graduated ramp).

    One ``WHEN "f" < stop`` branch per stop preserves every (stop, colour) pair so
    the import side recovers the exact ``colorStops``; the final colour repeats in
    ``ELSE`` for values above the last stop.
    """
    branches = " ".join(
        f'WHEN "{field}" < {stop["stop"]} THEN {_color_rgba_literal(stop["color"])}'
        for stop in color_stops
    )
    return f"CASE {branches} ELSE {_color_rgba_literal(color_stops[-1]['color'])} END"


def _categorical_case_expr(field: str, color_stops: list[dict], fallback: Any) -> str:
    """A ``CASE`` mapping each category value to its colour."""
    branches = " ".join(
        f'WHEN "{field}" = {_sql_literal(stop["stop"])} '
        f"THEN {_color_rgba_literal(stop['color'])}"
        for stop in color_stops
    )
    return f"CASE {branches} ELSE {_color_rgba_literal(fallback)} END"


def _colorramp_stops(params: dict) -> list[dict]:
    """The colorRamp ``colorStops``, synthesised from the named ramp when absent.

    Real graduated layers often ship without materialised stops (the frontend
    classifies from the data at render time). Data-defined colour must bake the
    colours at export, so sample the named ramp over the scale's domain (or a
    [0, 1] default) — this keeps the field + ramp scheme through the round-trip.
    """
    stops = params.get("colorStops")
    if stops:
        return stops
    domain = params.get("domain") or [0.0, 1.0]
    n = max(int(params.get("nShades", 9)), 2)
    colors = sample_colors(
        params.get("name", "viridis"),
        n=n,
        reverse=params.get("reverse", False),
    )
    lo, hi = float(domain[0]), float(domain[1])
    return [
        {"stop": lo + (hi - lo) * i / (n - 1), "color": [float(c) for c in colors[i]]}
        for i in range(n)
    ]


def _scale_to_color_expr(scale: dict, field: str | None) -> str | None:
    """A data-defined colour expression for a colorRamp / categorical scale, or None.

    ``None`` means the scale cannot be encoded as a data-driven colour (no field,
    or a categorical with no materialised categories); the caller falls back to a
    constant colour.
    """
    scheme = scale.get("scheme")
    params = scale.get("params", {})
    if not field:
        return None
    if scheme == "colorRamp":
        return _colorramp_case_expr(field, _colorramp_stops(params))
    if scheme == "categorical":
        stops = params.get("colorStops")
        if stops:
            return _categorical_case_expr(
                field,
                stops,
                params.get("fallback", _TRANSPARENT),
            )
    return None


def _rule_constant_color(rule: dict, color_channels: set[str]) -> Any:
    """The constant_rgba colour a (guarded) rule paints on its colour channel."""
    for mapping in rule.get("mappings", []):
        if set(mapping.get("channels", [])) & color_channels:
            scale = mapping.get("scale", {})
            if scale.get("scheme") == "constant_rgba":
                return scale.get("params", {}).get("value")
    return None


def _guarded_color_expr(
    base_expr: str,
    guarded_rules: list[dict],
    color_channels: set[str],
) -> str | None:
    """Wrap ``base_expr`` in a ``CASE`` honouring each rule-level ``when`` guard.

    A feature matching a guard takes that rule's constant colour; otherwise it
    falls through to ``base_expr`` (the unguarded styling).
    """
    branches = []
    for rule in guarded_rules:
        when_expr = _when_to_expr(rule.get("when") or [], rule.get("whenOp", "all"))
        color = _rule_constant_color(rule, color_channels)
        if when_expr and color is not None:
            branches.append(f"WHEN ({when_expr}) THEN {_color_rgba_literal(color)}")
    if not branches:
        return None
    return f"CASE {' '.join(branches)} ELSE {base_expr} END"


def grammar_layer_to_dd_symbol(
    grammar_layer: dict[str, Any],
    geometry_type: str,
    logs: dict[str, list[str]],
    layer_id: str,
):
    """One QGIS symbol whose channels are data-defined from a grammar layer."""
    rules = grammar_layer.get("rules", [])
    guarded_rules = [r for r in rules if r.get("when")]
    base_rules = [r for r in rules if not r.get("when")]

    # _collect_vector_style flattens the unguarded rules into the fill/stroke
    # scales plus the constant + data-defined (stroke colour/width, radius)
    # overrides; _make_base_symbol applies all of those to a fresh symbol.
    style = _collect_vector_style({"rules": base_rules}, logs, layer_id)
    symbol = _make_base_symbol(geometry_type, 1.0, style)
    if symbol is None:
        return None
    symbol_layer = symbol.symbolLayer(0)

    is_line = geometry_type == "line"
    color_scale = style["stroke_scale"] if is_line else style["fill_scale"]
    color_field = style["stroke_field"] if is_line else style["fill_field"]
    color_channels = _STROKE_COLOR_CHANNELS if is_line else _FILL_CHANNELS
    color_prop = (
        QgsSymbolLayer.PropertyStrokeColor
        if is_line
        else QgsSymbolLayer.PropertyFillColor
    )

    color_expr: str | None = None
    plain_constant: Any = None

    if color_scale and color_scale.get("scheme") == "identity" and color_field:
        # A field-driven colour (the field already holds colour values).
        symbol_layer.setDataDefinedProperty(
            color_prop,
            QgsProperty.fromField(color_field),
        )
    else:
        if color_scale is None or color_scale.get("scheme") == "constant_rgba":
            if color_scale is not None:
                base_color = color_scale["params"].get("value")
            elif is_line:
                base_color = style["stroke_rgba"]
            elif geometry_type == "fill":
                # A polygon with no fill mapping renders no fill in JupyterGIS.
                base_color = list(_TRANSPARENT)
            else:
                base_color = list(_DEFAULT_FILL)
            base_expr = _color_rgba_literal(base_color)
            plain_constant = base_color
        else:
            base_expr = _scale_to_color_expr(color_scale, color_field)
            if base_expr is None:
                base_color = (
                    list(_TRANSPARENT)
                    if geometry_type == "fill"
                    else list(_DEFAULT_FILL)
                )
                base_expr = _color_rgba_literal(base_color)
                plain_constant = base_color

        if guarded_rules:
            guarded = _guarded_color_expr(base_expr, guarded_rules, color_channels)
            if guarded:
                color_expr = guarded
                plain_constant = None
        if color_expr is None and plain_constant is None:
            color_expr = base_expr  # a colorRamp / categorical CASE

        if color_expr is not None:
            symbol_layer.setDataDefinedProperty(
                color_prop,
                QgsProperty.fromExpression(color_expr),
            )
        elif plain_constant is not None:
            symbol.setColor(_rgba_to_qcolor(plain_constant))

    if geometry_type == "circle" and style.get("radius_prop") is None:
        symbol.setSize(2 * style["radius"])

    return symbol


def grammar_layer_to_renderer(
    grammar_layer: dict[str, Any],
    geometry_type: str,
    opacity: float,
    map_layer,
    logs: dict[str, list[str]],
    layer_id: str,
):
    """Build a QGIS renderer for one grammar rendering layer, or None.

    Vector-symbol layers become a single ``QgsSingleSymbolRenderer`` with
    data-defined channels. KDE (heatmap) and cluster layers keep their dedicated
    renderers (no data-defined equivalent). ``map_layer`` is unused now that the
    data drives the symbol via expressions rather than classified renderers.
    """
    preprocess = grammar_layer.get("preprocess") or []
    if any(t.get("type") == "kde" for t in preprocess):
        return _heatmap_renderer(grammar_layer)

    symbol = grammar_layer_to_dd_symbol(grammar_layer, geometry_type, logs, layer_id)
    if symbol is None:
        return None
    symbol.setOpacity(opacity)
    renderer = QgsSingleSymbolRenderer(symbol)

    if any(t.get("type") == "cluster" for t in preprocess):
        return _cluster_renderer(preprocess, renderer)
    return renderer


# ---------------------------------------------------------------------------
# Colour-expression decoding (import)
# ---------------------------------------------------------------------------
def _color_rgba_args(node) -> list[float] | None:
    """The grammar [r,g,b,a] (a 0-1) of a ``color_rgba(...)`` call node, or None."""
    if not isinstance(node, QgsExpressionNodeFunction):
        return None
    fn = QgsExpression.Functions()[node.fnIndex()]
    if fn.name() != "color_rgba":
        return None
    args = node.args().list()
    if len(args) != 4 or not all(isinstance(a, QgsExpressionNodeLiteral) for a in args):
        return None
    r, g, b, a = (a.value() for a in args)
    return [float(r), float(g), float(b), float(a) / 255]


def _parse_color_expr(expr: str):
    """Classify a data-defined colour ``CASE`` expression.

    Returns one of:
    - ``("colorRamp", field, color_stops)`` — all ``"f" < v`` branches (>=2),
    - ``("categorical", field, color_stops)`` — all ``"f" = v`` branches (>=2),
    - ``("guarded", else_rgba, [(when, when_op, rgba), ...])`` — anything else,
    - ``None`` — not a recognised CASE (caller uses the symbol's constant colour).
    """
    # Imported lazily: these live in qgis_loader, which imports this module.
    from .qgis_loader import _comparison_node, _expr_to_when

    parsed = QgsExpression(expr or "")
    if parsed.hasParserError() or parsed.rootNode() is None:
        return None
    node = parsed.rootNode()
    if not isinstance(node, QgsExpressionNodeCondition):
        return None

    branches = []
    for condition in node.conditions():
        cmp = _comparison_node(condition.whenExp())
        rgba = _color_rgba_args(condition.thenExp())
        branches.append((condition.whenExp(), cmp, rgba))
    else_rgba = _color_rgba_args(node.elseExp())

    comparisons = [cmp for _, cmp, _ in branches]
    fields = {cmp[0] for cmp in comparisons if cmp}
    if len(branches) >= 2 and len(fields) == 1 and all(comparisons):
        field = next(iter(fields))
        ops = {cmp[1] for cmp in comparisons}
        if ops == {QgsExpressionNodeBinaryOperator.boEQ} and all(
            rgba is not None for _, _, rgba in branches
        ):
            stops = [{"stop": cmp[2], "color": rgba} for _, cmp, rgba in branches]
            return "categorical", field, stops
        if ops <= set(_LT_OPS) and all(rgba is not None for _, _, rgba in branches):
            stops = [
                {"stop": float(cmp[2]), "color": rgba} for _, cmp, rgba in branches
            ]
            return "colorRamp", field, stops

    guards = []
    for when_node, _, rgba in branches:
        when, when_op = _expr_to_when(when_node.dump())
        if when and rgba is not None:
            guards.append((when, when_op, rgba))
    if guards:
        return "guarded", else_rgba, guards
    return None


def _set_primary_color_mapping(grammar: dict, scale: dict, field: str, geometry: str):
    """Replace a built grammar's primary colour mapping (used for identity)."""
    channels = (
        ["stroke-color"] if geometry == "line" else ["fill-color", "circle-fill-color"]
    )
    rule = grammar["layers"][0]["rules"][0]
    for mapping in rule["mappings"]:
        if set(mapping["channels"]) & set(channels):
            mapping["scale"] = scale
            rule["fields"] = [field]
            return grammar
    return grammar


def dd_symbol_to_grammar(symbol):
    """Convert a data-defined single symbol back into a Grammar symbologyState."""
    from .qgis_loader import (
        _add_data_defined_rule,
        _extract_symbol_style,
        _merge_data_defined_mappings,
    )

    fill, stroke, stroke_width, radius, geometry = _extract_symbol_style(symbol)
    is_line = geometry == "line"
    color_prop_key = (
        QgsSymbolLayer.PropertyStrokeColor
        if is_line
        else QgsSymbolLayer.PropertyFillColor
    )

    parsed = None
    symbol_layer = symbol.symbolLayer(0) if symbol is not None else None
    if symbol_layer is not None:
        prop = symbol_layer.dataDefinedProperties().property(color_prop_key)
        if prop is not None and prop.isActive():
            if prop.field():
                parsed = ("identity", prop.field())
            elif prop.expressionString():
                parsed = _parse_color_expr(prop.expressionString())

    kind = parsed[0] if parsed else None

    if kind == "colorRamp":
        _, field, stops = parsed
        grammar = graduated_grammar(
            field,
            "viridis",
            len(stops),
            "equal interval",
            stroke,
            stroke_width,
            radius,
            color_stops=stops,
            geometry=geometry,
        )
        return _add_data_defined_rule(grammar, symbol)

    if kind == "categorical":
        _, field, stops = parsed
        grammar = categorized_grammar(
            field,
            "viridis",
            stroke,
            stroke_width,
            radius,
            color_stops=stops,
            geometry=geometry,
        )
        return _add_data_defined_rule(grammar, symbol)

    if kind == "guarded":
        _, else_rgba, guards = parsed
        base_fill = else_rgba if (else_rgba and not is_line) else fill
        base_stroke = else_rgba if (else_rgba and is_line) else stroke
        grammar = single_symbol_grammar(
            base_fill,
            base_stroke,
            stroke_width,
            radius,
            geometry,
        )
        color_channels = (
            ["stroke-color"] if is_line else ["fill-color", "circle-fill-color"]
        )
        for when, when_op, rgba in guards:
            rule: dict[str, Any] = {
                "id": _new_rule_id(),
                "mappings": [
                    {
                        "scale": {"scheme": "constant_rgba", "params": {"value": rgba}},
                        "channels": color_channels,
                    },
                ],
                "when": when,
            }
            if when_op and when_op != "all":
                rule["whenOp"] = when_op
            grammar["layers"][0]["rules"].append(rule)
        return _merge_data_defined_mappings(grammar, symbol)

    grammar = single_symbol_grammar(fill, stroke, stroke_width, radius, geometry)
    if kind == "identity":
        grammar = _set_primary_color_mapping(
            grammar,
            {"scheme": "identity"},
            parsed[1],
            geometry,
        )
    return _merge_data_defined_mappings(grammar, symbol)


def _new_rule_id() -> str:
    from .grammar import _new_id

    return _new_id()
