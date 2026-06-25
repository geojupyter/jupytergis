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

import json
from typing import Any

from jupytergis_core.color_ramps import sample_colors
from qgis.core import (  # type: ignore[import-untyped]
    Qgis,
    QgsExpression,
    QgsExpressionNodeBinaryOperator,
    QgsExpressionNodeCondition,
    QgsExpressionNodeFunction,
    QgsExpressionNodeLiteral,
    QgsFillSymbol,
    QgsLineSymbol,
    QgsMarkerSymbol,
    QgsProperty,
    QgsSingleSymbolRenderer,
    QgsSymbolLayer,
)

from .grammar import (
    _DEFAULT_FILL,
    _DEFAULT_RADIUS,
    _DEFAULT_STROKE_WIDTH,
    _FILL_CHANNELS,
    _OL_CANVAS_STROKE,
    _RADIUS_CHANNELS,
    _STROKE_COLOR_CHANNELS,
    _STROKE_WIDTH_CHANNELS,
    _TRANSPARENT,
    _cluster_renderer,
    _comparison_node,
    _expr_to_when,
    _extract_symbol_style,
    _heatmap_renderer,
    _new_id,
    _rgba_to_qcolor,
    _scalar_from_property,
    _scalar_size_expr,
    _scale_linear_expr,
    _sql_literal,
    _warn,
    _when_to_expr,
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


def _rule_color_expr(rule: dict, color_channels: set[str]) -> str | None:
    """The colour a (guarded) rule paints, as a data-defined expression.

    A guarded rule may carry any colour scale (constant, identity, categorical,
    colorRamp), so it reuses the same slot encoder as the base symbol via
    :func:`_color_instruction` — returning only constants here dropped categorical /
    colorRamp guard colours (e.g. roads coloured by ``type`` only ``WHEN continent =
    'Asia'``), leaving the symbol black.
    """
    scale, field = _find_mapping([rule], color_channels)
    if not scale:
        return None
    instr = _color_instruction(scale, field)
    return _instr_color_expr(instr) if instr else None


def _guarded_color_expr(
    base_expr: str,
    guarded_rules: list[dict],
    color_channels: set[str],
) -> str | None:
    """Wrap ``base_expr`` in a ``CASE`` honouring each rule-level ``when`` guard.

    A feature matching a guard takes that rule's colour (constant, categorical or
    colorRamp); otherwise it falls through to ``base_expr`` (the unguarded styling).
    """
    branches = []
    for rule in guarded_rules:
        when_expr = _when_to_expr(rule.get("when") or [], rule.get("whenOp", "all"))
        color_expr = _rule_color_expr(rule, color_channels)
        if when_expr and color_expr is not None:
            branches.append(f"WHEN ({when_expr}) THEN {color_expr}")
    if not branches:
        return None
    return f"CASE {' '.join(branches)} ELSE {base_expr} END"


# ---------------------------------------------------------------------------
# Geometry-aware colour / width / radius slots (shared by export + import)
# ---------------------------------------------------------------------------
def _color_slots(geometry: str):
    """(grammar channel set, QGIS property, is_primary) per colour slot.

    A line has one colour (its stroke) and accepts either fill or stroke channels
    for it; an area/point has a primary fill and a secondary outline (stroke).
    """
    if geometry == "line":
        return [
            (
                _FILL_CHANNELS | _STROKE_COLOR_CHANNELS,
                QgsSymbolLayer.PropertyStrokeColor,
                True,
            ),
        ]
    return [
        (_FILL_CHANNELS, QgsSymbolLayer.PropertyFillColor, True),
        (_STROKE_COLOR_CHANNELS, QgsSymbolLayer.PropertyStrokeColor, False),
    ]


def _find_mapping(rules: list[dict], channel_set: set[str]):
    """The first ``(scale, field)`` whose mapping touches ``channel_set``."""
    for rule in rules:
        field = (rule.get("fields") or [None])[0]
        for mapping in rule.get("mappings", []):
            if set(mapping.get("channels", [])) & channel_set:
                return mapping.get("scale", {}), field
    return None, None


def _color_instruction(scale: dict, field: str | None):
    """A colour as ``('const', rgba)`` / ``('field', name)`` / ``('expr', str)``.

    ``None`` means the scale cannot be encoded (caller warns + uses a default).
    Handles every colour scale uniformly, on any slot (primary or outline).
    """
    scheme = scale.get("scheme")
    params = scale.get("params", {})
    if scheme == "constant_rgba":
        value = params.get("value")
        return ("const", value) if value is not None else None
    if scheme == "identity" and field:
        return ("field", field)
    if scheme == "colorRamp" and field:
        return ("expr", _colorramp_case_expr(field, _colorramp_stops(params)))
    if scheme == "categorical" and field:
        stops = params.get("colorStops")
        if stops:
            return (
                "expr",
                _categorical_case_expr(
                    field,
                    stops,
                    params.get("fallback", _TRANSPARENT),
                ),
            )
    return None


def _num_instruction(scale: dict, field: str | None, is_radius: bool):
    """A width/radius as ``('const', n)`` / ``('field', name)`` / ``('expr', str)``."""
    scheme = scale.get("scheme")
    params = scale.get("params", {})
    if scheme == "constant_num":
        value = params.get("value")
        return ("const", value) if value is not None else None
    if scheme == "identity" and field:
        return ("field", field)
    if scheme == "scalar":
        expr = (
            _scalar_size_expr(field, params)
            if is_radius
            else _scale_linear_expr(field, params)
        )
        if expr:
            return ("expr", expr)
    return None


def _instr_color_expr(instr) -> str:
    """A colour instruction rendered as an expression (for guard nesting)."""
    kind, value = instr
    if kind == "const":
        return _color_rgba_literal(value)
    if kind == "field":
        return f'"{value}"'
    return value


def _default_primary_color(geometry: str) -> list:
    # A polygon with no fill renders transparent (a stroke-only layer keeps no
    # fill); a point defaults to the OL fill; a line falls back to canvas black.
    if geometry == "fill":
        return list(_TRANSPARENT)
    if geometry == "circle":
        return list(_DEFAULT_FILL)
    return list(_OL_CANVAS_STROKE)


# Layer custom-property key under which the per-slot ramp identity is stashed.
_RAMP_META_KEY = "jgis/colorRamps"


def _ramp_meta(grammar_layer: dict[str, Any], geometry_type: str) -> dict:
    """Per-slot ramp identity (name + reverse) that a data-defined CASE can't carry.

    Export bakes a colorRamp / categorical scale into concrete colours (a vector
    ``color_rgba`` CASE, or a QGIS heatmap gradient): the colours render correctly
    but *which* named ramp produced them is lost, so on reopen the colormap picker
    would show "custom". Capture the name and direction per colour slot (the vector
    fill/outline slots plus the heatmap ``pixel-rgb`` ramp) so import can restore the
    original selection.
    """
    base_rules = [r for r in grammar_layer.get("rules", []) if not r.get("when")]
    meta: dict[str, dict] = {}
    # The KDE heatmap ramp lives on the pixel-rgb channel, outside the vector slots.
    hscale, _hfield = _find_mapping(base_rules, {"pixel-rgb"})
    if hscale and hscale.get("scheme") == "colorRamp":
        hparams = hscale.get("params", {})
        meta["heatmap"] = {
            "name": hparams.get("name", "viridis"),
            "reverse": bool(hparams.get("reverse", False)),
        }
    for channel_set, _prop, is_primary in _color_slots(geometry_type):
        scale, field = _find_mapping(base_rules, channel_set)
        if not scale or not field:
            continue
        params = scale.get("params", {})
        slot = "primary" if is_primary else "outline"
        if scale.get("scheme") == "colorRamp":
            meta[slot] = {
                "name": params.get("name", "viridis"),
                "reverse": bool(params.get("reverse", False)),
            }
        elif scale.get("scheme") == "categorical" and params.get("colorStops"):
            meta[slot] = {
                "name": params.get("colorRamp", "viridis"),
                "reverse": bool(params.get("reverse", False)),
            }
    return meta


def grammar_layer_to_dd_symbol(
    grammar_layer: dict[str, Any],
    geometry_type: str,
    logs: dict[str, list[str]],
    layer_id: str,
):
    """One QGIS symbol whose channels are data-defined from a grammar layer.

    Every channel is resolved by geometry-aware *slot* — the primary colour (fill
    for area/point, stroke for a line), the outline colour (area/point only), the
    width and the marker radius. Each slot accepts any scale (constant / identity
    / categorical / colorRamp) and rule-level ``when`` guards wrap the primary
    colour in a nested CASE. A scale that cannot translate warns rather than
    silently dropping to black.
    """
    if geometry_type == "circle":
        symbol = QgsMarkerSymbol()
    elif geometry_type == "line":
        symbol = QgsLineSymbol()
    elif geometry_type == "fill":
        symbol = QgsFillSymbol()
    else:
        return None
    symbol.setOutputUnit(Qgis.RenderUnit.Pixels)
    sl = symbol.symbolLayer(0)

    rules = grammar_layer.get("rules", [])
    base_rules = [r for r in rules if not r.get("when")]
    guarded_rules = [r for r in rules if r.get("when")]
    is_line = geometry_type == "line"

    # --- colour slots (primary + outline) ---
    for channel_set, prop, is_primary in _color_slots(geometry_type):
        scale, field = _find_mapping(base_rules, channel_set)
        instr = _color_instruction(scale, field) if scale else None
        if scale and instr is None:
            _warn(
                logs,
                layer_id,
                f"data-driven {'fill' if is_primary else 'stroke'} colour could not "
                "be translated; using a solid colour.",
            )
        if instr is None:
            default = (
                _default_primary_color(geometry_type)
                if is_primary
                else list(_OL_CANVAS_STROKE)
            )
            instr = ("const", default)
        if is_primary and guarded_rules:
            guarded = _guarded_color_expr(
                _instr_color_expr(instr),
                guarded_rules,
                channel_set,
            )
            if guarded:
                instr = ("expr", guarded)
        kind, value = instr
        if kind == "const":
            (symbol.setColor if is_primary else sl.setStrokeColor)(
                _rgba_to_qcolor(value),
            )
        elif kind == "field":
            sl.setDataDefinedProperty(prop, QgsProperty.fromField(value))
        else:
            sl.setDataDefinedProperty(prop, QgsProperty.fromExpression(value))

    # --- width (line width or outline width) ---
    wscale, wfield = _find_mapping(base_rules, _STROKE_WIDTH_CHANNELS)
    winstr = _num_instruction(wscale, wfield, False) if wscale else None
    if wscale and winstr is None:
        _warn(
            logs,
            layer_id,
            "data-driven width could not be translated; using a constant width.",
        )
    if winstr is None:
        winstr = ("const", _DEFAULT_STROKE_WIDTH)
    wkind, wvalue = winstr
    if wkind == "const":
        (sl.setWidth if is_line else sl.setStrokeWidth)(float(wvalue))
    elif wkind == "field":
        sl.setDataDefinedProperty(
            QgsSymbolLayer.PropertyStrokeWidth,
            QgsProperty.fromField(wvalue),
        )
    else:
        sl.setDataDefinedProperty(
            QgsSymbolLayer.PropertyStrokeWidth,
            QgsProperty.fromExpression(wvalue),
        )

    # --- marker radius (points only) ---
    if geometry_type == "circle":
        rscale, rfield = _find_mapping(base_rules, _RADIUS_CHANNELS)
        rinstr = _num_instruction(rscale, rfield, True) if rscale else None
        if rscale and rinstr is None:
            _warn(
                logs,
                layer_id,
                "data-driven circle radius could not be translated; using a "
                "constant radius.",
            )
        if rinstr is None:
            rinstr = ("const", _DEFAULT_RADIUS)
        rkind, rvalue = rinstr
        if rkind == "const":
            symbol.setSize(2 * float(rvalue))
        elif rkind == "field":
            symbol.setDataDefinedSize(QgsProperty.fromField(rvalue))
        else:
            symbol.setDataDefinedSize(QgsProperty.fromExpression(rvalue))

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
    renderers (no data-defined equivalent). The named colour ramp is stashed on
    ``map_layer`` so import can restore the picker selection (see
    :func:`_ramp_meta`).
    """
    preprocess = grammar_layer.get("preprocess") or []
    # Stash the named ramp(s) for every renderer kind (heatmap included) before the
    # KDE early-return, so import can restore the picker instead of showing "custom".
    if map_layer is not None:
        meta = _ramp_meta(grammar_layer, geometry_type)
        if meta:
            map_layer.setCustomProperty(_RAMP_META_KEY, json.dumps(meta))
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


def _color_scale_from_property(ddp, prop_key, const_rgba, ramp=None):
    """Read a colour slot back into ``(scale, field, guards)``.

    The inverse of the export colour slot: a field reference -> identity, a
    ``CASE`` -> categorical / colorRamp / guarded, otherwise the symbol's constant.
    Used for both the primary and the outline colour so each round-trips with its
    own scale (not just identity). ``ramp`` is the slot's stashed ``{name, reverse}``
    (see :func:`_ramp_meta`) restoring the named ramp the baked stops can't carry.
    """
    ramp = ramp or {}
    ramp_name = ramp.get("name", "viridis")
    ramp_reverse = bool(ramp.get("reverse", False))
    if ddp is not None:
        prop = ddp.property(prop_key)
        if prop is not None and prop.isActive():
            if prop.field():
                return {"scheme": "identity"}, prop.field(), []
            expr = prop.expressionString()
            if expr:
                parsed = _parse_color_expr(expr)
                if parsed and parsed[0] == "colorRamp":
                    _, field, stops = parsed
                    return (
                        {
                            "scheme": "colorRamp",
                            "params": {
                                "name": ramp_name,
                                "nShades": len(stops),
                                "mode": "equal interval",
                                "reverse": ramp_reverse,
                                "fallback": list(_TRANSPARENT),
                                "colorStops": stops,
                            },
                        },
                        field,
                        [],
                    )
                if parsed and parsed[0] == "categorical":
                    _, field, stops = parsed
                    return (
                        {
                            "scheme": "categorical",
                            "params": {
                                "colorRamp": ramp_name,
                                "reverse": ramp_reverse,
                                "fallback": list(_TRANSPARENT),
                                "colorStops": stops,
                            },
                        },
                        field,
                        [],
                    )
                if parsed and parsed[0] == "guarded":
                    _, else_rgba, guards = parsed
                    base = else_rgba or const_rgba
                    return (
                        {"scheme": "constant_rgba", "params": {"value": base}},
                        None,
                        guards,
                    )
    return {"scheme": "constant_rgba", "params": {"value": const_rgba}}, None, []


def _num_scale_from_property(ddp, prop_key, const_value, scalar_from_property):
    """Read a width/radius slot back into ``(scale, field)``."""
    if ddp is not None:
        prop = ddp.property(prop_key)
        if prop is not None and prop.isActive():
            if prop.field():
                return {"scheme": "identity"}, prop.field()
            if prop.expressionString():
                scalar = scalar_from_property(prop)
                if scalar:
                    field, domain, output_range = scalar
                    return (
                        {
                            "scheme": "scalar",
                            "params": {
                                "domain": domain,
                                "range": output_range,
                                "mode": "equal interval",
                                "nStops": 5,
                                "fallback": 0.0,
                            },
                        },
                        field,
                    )
    return {"scheme": "constant_num", "params": {"value": const_value}}, None


def dd_symbol_to_grammar(symbol, ramp_meta=None):
    """Convert a data-defined single symbol back into a Grammar symbologyState.

    The exact inverse of :func:`grammar_layer_to_dd_symbol`: each slot (primary
    colour, outline colour, width, radius) is read back into a mapping, mappings
    are grouped into rules by their input field, and rule-level ``when`` guards
    become guarded rules. ``ramp_meta`` is the layer's stashed per-slot ramp
    identity (see :func:`_ramp_meta`) restoring the named ramp on each colour slot.
    """
    ramp_meta = ramp_meta or {}
    fill, stroke, stroke_width, radius, geometry = _extract_symbol_style(symbol)
    is_line = geometry == "line"
    sl = symbol.symbolLayer(0) if symbol is not None else None
    ddp = sl.dataDefinedProperties() if sl is not None else None

    collected: list = []  # (channels, scale, field)
    guard_rules: list[dict] = []

    # primary colour (fill for area/point, stroke for a line)
    primary_prop = (
        QgsSymbolLayer.PropertyStrokeColor
        if is_line
        else QgsSymbolLayer.PropertyFillColor
    )
    primary_channels = (
        ["stroke-color"] if is_line else ["fill-color", "circle-fill-color"]
    )
    primary_const = stroke if is_line else fill
    scale, field, guards = _color_scale_from_property(
        ddp,
        primary_prop,
        primary_const,
        ramp_meta.get("primary"),
    )
    collected.append((primary_channels, scale, field))
    for when, when_op, rgba in guards:
        rule = {
            "id": _new_id(),
            "when": when,
            "mappings": [
                {
                    "scale": {"scheme": "constant_rgba", "params": {"value": rgba}},
                    "channels": primary_channels,
                },
            ],
        }
        if when_op and when_op != "all":
            rule["whenOp"] = when_op
        guard_rules.append(rule)

    # outline colour (area / point only)
    if not is_line:
        s_scale, s_field, _ = _color_scale_from_property(
            ddp,
            QgsSymbolLayer.PropertyStrokeColor,
            stroke,
            ramp_meta.get("outline"),
        )
        collected.append((["stroke-color", "circle-stroke-color"], s_scale, s_field))

    # width
    w_scale, w_field = _num_scale_from_property(
        ddp,
        QgsSymbolLayer.PropertyStrokeWidth,
        stroke_width,
        _scalar_from_property,
    )
    w_channels = (
        ["stroke-width"] if is_line else ["stroke-width", "circle-stroke-width"]
    )
    collected.append((w_channels, w_scale, w_field))

    # marker radius
    if geometry == "circle":
        r_scale: dict = {"scheme": "constant_num", "params": {"value": radius}}
        r_field = None
        if isinstance(symbol, QgsMarkerSymbol):
            size_prop = symbol.dataDefinedSize()
            if (
                size_prop is not None
                and size_prop.isActive()
                and size_prop.expressionString()
            ):
                scalar = _scalar_from_property(size_prop)
                if scalar:
                    r_field, domain, output_range = scalar
                    r_scale = {
                        "scheme": "scalar",
                        "params": {
                            "domain": domain,
                            "range": output_range,
                            "mode": "equal interval",
                            "nStops": 5,
                            "fallback": 0.0,
                        },
                    }
        collected.append((["circle-radius"], r_scale, r_field))

    # group mappings into rules by their input field (constants share one rule)
    by_field: dict = {}
    const_mappings: list = []
    for channels, scale, field in collected:
        mapping = {"scale": scale, "channels": channels}
        if field is not None:
            by_field.setdefault(field, []).append(mapping)
        else:
            const_mappings.append(mapping)
    rules = [
        {"id": _new_id(), "fields": [field], "mappings": maps}
        for field, maps in by_field.items()
    ]
    if const_mappings:
        if rules:
            rules[0]["mappings"].extend(const_mappings)
        else:
            rules.append({"id": _new_id(), "mappings": const_mappings})
    rules.extend(guard_rules)
    if not rules:
        rules = [{"id": _new_id(), "mappings": []}]
    return {"layers": [{"id": _new_id(), "rules": rules}]}
