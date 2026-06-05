from __future__ import annotations

import re
import uuid
from typing import Any

from jupytergis_core.color_ramps import sample_colors
from jupytergis_core.colors import hex_to_rgba
from PyQt5.QtGui import QColor
from qgis.core import (  # type: ignore[import-untyped]
    Qgis,
    QgsCategorizedSymbolRenderer,
    QgsColorRampShader,
    QgsFillSymbol,
    QgsGradientColorRamp,
    QgsGraduatedSymbolRenderer,
    QgsHeatmapRenderer,
    QgsLineSymbol,
    QgsMarkerSymbol,
    QgsPointClusterRenderer,
    QgsProperty,
    QgsRasterShader,
    QgsRendererCategory,
    QgsRendererRange,
    QgsRuleBasedRenderer,
    QgsSingleBandPseudoColorRenderer,
    QgsSingleSymbolRenderer,
)

# Grammar defaults, mirroring packages/schema/src/grammar/grammarConversions.ts
# and python/jupytergis_core/.../migrations/v0_5_to_v0_6.py so import output stays
# consistent with the frontend migration.
_DEFAULT_STROKE_WIDTH = 1.25
_DEFAULT_FILL = [255.0, 255.0, 255.0, 0.4]
_DEFAULT_STROKE = [51.0, 153.0, 204.0, 1.0]
_DEFAULT_RADIUS = 5.0
_TRANSPARENT = [0.0, 0.0, 0.0, 0.0]

# Channel groups (see packages/schema/src/_interface/project/symbology.d.ts).
_FILL_CHANNELS = {"fill-color", "circle-fill-color"}
_STROKE_COLOR_CHANNELS = {"stroke-color", "circle-stroke-color"}
_STROKE_WIDTH_CHANNELS = {"stroke-width", "circle-stroke-width"}
_RADIUS_CHANNELS = {"circle-radius"}
_PIXEL_COLOR_CHANNELS = {"pixel-color", "pixel-rgb"}
_PIXEL_ALPHA_CHANNELS = {"pixel-alpha"}

# jGIS classification mode name -> QgsGraduatedSymbolRenderer method constant.
_GRADUATED_MODE_MAP = {
    "equal interval": 0,  # EqualInterval
    "quantile": 1,  # Quantile
    "jenks": 2,  # Jenks
    "pretty": 4,  # Pretty
    "logarithmic": 3,  # StdDev (closest match)
}


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def _new_id() -> str:
    return str(uuid.uuid4())


def _warn(logs: dict[str, list[str]], layer_id: str, message: str) -> None:
    logs["warnings"].append(f"Layer {layer_id}: {message}")


def _rgba_to_qcolor(rgba: Any) -> QColor:
    """Convert an [r, g, b, a] list (a in 0-1) or '#rrggbb' string to QColor."""
    if isinstance(rgba, str) and rgba.startswith("#"):
        r, g, b, a = hex_to_rgba(rgba)
        return QColor(int(r), int(g), int(b), int(a * 255))
    if isinstance(rgba, (list, tuple)) and len(rgba) == 4:
        r, g, b, a = rgba
        return QColor(int(r), int(g), int(b), int(a * 255))
    return QColor(0, 0, 0, 255)


def _qcolor_to_rgba(color: QColor) -> list[float]:
    """Convert a QColor to a grammar [r, g, b, a] list (a in 0-1)."""
    return [
        float(color.red()),
        float(color.green()),
        float(color.blue()),
        float(color.alpha()) / 255,
    ]


def _parse_band(fields: list[str]) -> int | None:
    """Return the band index from a ``$band-N`` pseudo-field, if present."""
    for field in fields:
        match = re.match(r"^\$band-(\d+)$", str(field))
        if match:
            return int(match.group(1))
    return None


# ---------------------------------------------------------------------------
# Import: QGIS renderer -> Grammar symbologyState
# ---------------------------------------------------------------------------
def single_symbol_grammar(
    fill: list,
    stroke: list,
    stroke_width: float,
    radius: float,
) -> dict[str, Any]:
    """Grammar for a constant (Single Symbol) style."""
    rule = {
        "id": _new_id(),
        "mappings": [
            {
                "scale": {"scheme": "constant_rgba", "params": {"value": fill}},
                "channels": ["fill-color", "circle-fill-color"],
            },
            {
                "scale": {"scheme": "constant_rgba", "params": {"value": stroke}},
                "channels": ["stroke-color", "circle-stroke-color"],
            },
            {
                "scale": {"scheme": "constant_num", "params": {"value": stroke_width}},
                "channels": ["stroke-width", "circle-stroke-width"],
            },
            {
                "scale": {"scheme": "constant_num", "params": {"value": radius}},
                "channels": ["circle-radius"],
            },
        ],
    }
    return {"layers": [{"id": _new_id(), "rules": [rule]}]}


def graduated_grammar(
    field: str | None,
    color_ramp: str,
    n_classes: int,
    mode: str,
    stroke: list,
    stroke_width: float,
    radius: float,
    reverse: bool = False,
) -> dict[str, Any]:
    """Grammar for a graduated (colorRamp on numeric field) style."""
    color_ramp_scale = {
        "scheme": "colorRamp",
        "params": {
            "name": color_ramp,
            "nShades": n_classes,
            "mode": mode,
            "reverse": reverse,
            "fallback": list(_TRANSPARENT),
        },
    }
    mappings = [
        {"scale": color_ramp_scale, "channels": ["fill-color", "circle-fill-color"]},
        {
            "scale": {"scheme": "constant_rgba", "params": {"value": stroke}},
            "channels": ["stroke-color", "circle-stroke-color"],
        },
        {
            "scale": {"scheme": "constant_num", "params": {"value": stroke_width}},
            "channels": ["stroke-width", "circle-stroke-width"],
        },
        {
            "scale": {"scheme": "constant_num", "params": {"value": radius}},
            "channels": ["circle-radius"],
        },
    ]
    rule: dict[str, Any] = {"id": _new_id(), "mappings": mappings}
    if field:
        rule["fields"] = [field]
    return {"layers": [{"id": _new_id(), "rules": [rule]}]}


def categorized_grammar(
    field: str | None,
    color_ramp: str,
    stroke: list,
    stroke_width: float,
    radius: float,
    reverse: bool = False,
) -> dict[str, Any]:
    """Grammar for a categorized (categorical scale on a field) style."""
    categorical_scale = {
        "scheme": "categorical",
        "params": {
            "colorRamp": color_ramp,
            "reverse": reverse,
            "fallback": list(_TRANSPARENT),
        },
    }
    mappings = [
        {"scale": categorical_scale, "channels": ["fill-color", "circle-fill-color"]},
        {
            "scale": {"scheme": "constant_rgba", "params": {"value": stroke}},
            "channels": ["stroke-color", "circle-stroke-color"],
        },
        {
            "scale": {"scheme": "constant_num", "params": {"value": stroke_width}},
            "channels": ["stroke-width", "circle-stroke-width"],
        },
        {
            "scale": {"scheme": "constant_num", "params": {"value": radius}},
            "channels": ["circle-radius"],
        },
    ]
    rule: dict[str, Any] = {"id": _new_id(), "mappings": mappings}
    if field:
        rule["fields"] = [field]
    return {"layers": [{"id": _new_id(), "rules": [rule]}]}


def flat_colors_to_grammar(colors: dict[str, list]) -> dict[str, Any]:
    """Grammar with one constant_rgba mapping per channel (used for vector tiles).

    ``colors`` maps a style channel name to an [r, g, b, a] list.
    """
    mappings = [
        {
            "scale": {"scheme": "constant_rgba", "params": {"value": rgba}},
            "channels": [channel],
        }
        for channel, rgba in colors.items()
    ]
    if not mappings:
        return {"layers": []}
    rule = {"id": _new_id(), "mappings": mappings}
    return {"layers": [{"id": _new_id(), "rules": [rule]}]}


def raster_to_grammar(
    color_ramp_items: list,
    band: int,
    source_min: float,
    source_max: float,
) -> dict[str, Any]:
    """Grammar for a single-band pseudocolor raster from QGIS color ramp items.

    QGIS discrete/exact ramps are approximated as an interpolated colorRamp; the
    explicit ``colorStops`` preserve the exact value→color pairs either way.
    """
    color_stops = []
    for node in color_ramp_items:
        value = node.value
        if value in (float("inf"), float("-inf")):
            continue
        color_stops.append({"stop": value, "color": _qcolor_to_rgba(node.color)})

    params = {
        "name": "custom",
        "domain": [source_min, source_max],
        "nShades": len(color_stops),
        "mode": "equal interval",
        "reverse": False,
        "fallback": list(_TRANSPARENT),
        "colorStops": color_stops,
    }
    rule = {
        "id": _new_id(),
        "fields": [f"$band-{int(band)}"],
        "mappings": [
            {
                "scale": {"scheme": "colorRamp", "params": params},
                "channels": ["pixel-color"],
            },
        ],
    }
    return {"layers": [{"id": _new_id(), "rules": [rule]}]}


def kde_grammar(
    radius: float,
    weight_field: str | None,
    color_stops: list | None,
) -> dict[str, Any]:
    """Grammar for a KDE heatmap layer read back from a QgsHeatmapRenderer."""
    params: dict[str, Any] = {
        "name": "custom",
        "nShades": len(color_stops) if color_stops else 9,
        "mode": "equal interval",
        "reverse": False,
        "fallback": list(_TRANSPARENT),
    }
    if color_stops:
        params["colorStops"] = color_stops
    rule = {
        "id": _new_id(),
        "fields": ["$density"],
        "mappings": [
            {
                "scale": {"scheme": "colorRamp", "params": params},
                "channels": ["pixel-rgb"],
            },
        ],
    }
    kde: dict[str, Any] = {"type": "kde", "radius": radius, "blur": 0}
    if weight_field:
        kde["weightField"] = weight_field
    return {"layers": [{"id": _new_id(), "preprocess": [kde], "rules": [rule]}]}


def cluster_grammar(inner_grammar: dict[str, Any], radius: float) -> dict[str, Any]:
    """Grammar for a cluster layer; wraps the embedded renderer's rules."""
    inner_layers = inner_grammar.get("layers", [])
    rules = inner_layers[0]["rules"] if inner_layers else []
    return {
        "layers": [
            {
                "id": _new_id(),
                "preprocess": [{"type": "cluster", "radius": radius}],
                "rules": rules,
            },
        ],
    }


# ---------------------------------------------------------------------------
# Predicates / filters -> QGIS expression (subset string)
# ---------------------------------------------------------------------------
# Grammar geometryType -> value returned by QGIS geometry_type($geometry).
_GEOMETRY_TYPE_MAP = {"Point": "Point", "LineString": "Line", "Polygon": "Polygon"}


def _sql_literal(value: Any) -> str:
    if isinstance(value, str):
        escaped = value.replace("'", "''")
        return f"'{escaped}'"
    return str(value)


def _predicate_to_expr(predicate: dict[str, Any]) -> str | None:
    """Translate one grammar `when` predicate to a QGIS expression string."""
    kind = predicate.get("type")
    field = predicate.get("field")
    if kind == "fieldEquals":
        return f'"{field}" = {_sql_literal(predicate.get("value"))}'
    if kind == "fieldCompare":
        return f'"{field}" {predicate.get("op")} {_sql_literal(predicate.get("value"))}'
    if kind == "between":
        return (
            f'"{field}" >= {_sql_literal(predicate.get("min"))} '
            f'AND "{field}" <= {_sql_literal(predicate.get("max"))}'
        )
    if kind == "hasField":
        return f'"{field}" IS NOT NULL'
    if kind == "geometryType":
        qgis_geom = _GEOMETRY_TYPE_MAP.get(predicate.get("value"))
        if qgis_geom:
            return f"geometry_type($geometry) = '{qgis_geom}'"
    return None


def _when_to_expr(when: list[dict[str, Any]], when_op: str) -> str | None:
    """Combine grammar `when` predicates into a single QGIS expression."""
    exprs = [e for p in (when or []) if (e := _predicate_to_expr(p))]
    if not exprs:
        return None
    if len(exprs) == 1:
        return exprs[0]
    joiner = " OR " if when_op == "any" else " AND "
    return joiner.join(f"({e})" for e in exprs)


def grammar_layer_subset(grammar_layer: dict[str, Any]) -> str | None:
    """QGIS subset string for a grammar layer's layer-level `when` predicates."""
    return _when_to_expr(
        grammar_layer.get("when") or [],
        grammar_layer.get("whenOp", "all"),
    )


def subset_to_when(subset: str | None) -> list[dict[str, Any]] | None:
    """Best-effort inverse of a QGIS subset string into grammar `when` predicates.

    Handles the single-comparison form we emit (e.g. ``"continent" = 'Asia'`` or
    ``"mag" > 5``). Returns None for anything more complex (the caller then just
    drops the filter rather than producing a wrong predicate).
    """
    if not subset:
        return None
    match = re.match(r'^\s*"([^"]+)"\s*(<=|>=|!=|=|<|>)\s*(.+?)\s*$', subset)
    if not match:
        return None
    field, op, raw = match.group(1), match.group(2), match.group(3)

    if len(raw) >= 2 and raw[0] == "'" and raw[-1] == "'":
        value: Any = raw[1:-1].replace("''", "'")
        is_string = True
    else:
        try:
            value = float(raw)
            value = int(value) if value.is_integer() else value
            is_string = False
        except ValueError:
            return None

    if op == "=":
        return [{"type": "fieldEquals", "field": field, "value": value}]
    if is_string:
        # fieldCompare only supports numeric values.
        return None
    return [{"type": "fieldCompare", "field": field, "op": op, "value": value}]


def filters_to_subset(filters: dict[str, Any] | None) -> str | None:
    """QGIS subset string for a jGIS layer's ``filters`` (logicalOp + appliedFilters)."""
    if not filters:
        return None
    applied = filters.get("appliedFilters") or []
    exprs = []
    for item in applied:
        feature = item.get("feature")
        operator = item.get("operator")
        if operator == "between":
            exprs.append(
                f'"{feature}" >= {_sql_literal(item.get("betweenMin"))} '
                f'AND "{feature}" <= {_sql_literal(item.get("betweenMax"))}',
            )
        elif operator == "==":
            exprs.append(f'"{feature}" = {_sql_literal(item.get("value"))}')
        else:
            exprs.append(f'"{feature}" {operator} {_sql_literal(item.get("value"))}')
    if not exprs:
        return None
    if len(exprs) == 1:
        return exprs[0]
    joiner = " OR " if filters.get("logicalOp") == "any" else " AND "
    return joiner.join(f"({e})" for e in exprs)


def combine_subsets(*subsets: str | None) -> str | None:
    """AND together non-empty subset strings."""
    parts = [s for s in subsets if s]
    if not parts:
        return None
    if len(parts) == 1:
        return parts[0]
    return " AND ".join(f"({p})" for p in parts)


# ---------------------------------------------------------------------------
# Export: Grammar symbologyState -> QGIS renderer
# ---------------------------------------------------------------------------
def _scalar_size_expr(field: str | None, params: dict[str, Any]) -> str | None:
    """QGIS data-defined marker-size expression for a scalar circle-radius scale.

    Grammar circle-radius is a radius; a QGIS marker's size is the diameter, so
    the linear mapping is doubled.
    """
    domain = params.get("domain")
    output_range = params.get("range")
    if not (
        field
        and isinstance(domain, list)
        and len(domain) == 2
        and isinstance(output_range, list)
        and len(output_range) == 2
    ):
        return None
    d0, d1 = domain
    r0, r1 = output_range
    return f'2 * scale_linear("{field}", {d0}, {d1}, {r0}, {r1})'


def grammar_layer_geometry_hint(grammar_layer: dict[str, Any]) -> str | None:
    """Best-effort geometry when the data can't be loaded to infer it.

    Grammar is geometry-agnostic, but a *data-driven* (scalar) circle-radius
    only makes sense for points, so it's a strong "circle" signal.
    """
    for rule in grammar_layer.get("rules", []):
        for mapping in rule.get("mappings", []):
            if (
                "circle-radius" in mapping.get("channels", [])
                and mapping.get("scale", {}).get("scheme") == "scalar"
            ):
                return "circle"
    return None


def grammar_layer_alpha_factor(grammar_layer: dict[str, Any]) -> float:
    """Constant pixel-alpha/fill-alpha for a grammar layer, applied as layer opacity."""
    for rule in grammar_layer.get("rules", []):
        for mapping in rule.get("mappings", []):
            channels = set(mapping.get("channels", []))
            if channels & {"pixel-alpha", "fill-alpha"}:
                scale = mapping.get("scale", {})
                if scale.get("scheme") == "constant_num":
                    return scale.get("params", {}).get("value", 1.0)
    return 1.0


def _collect_vector_style(
    grammar_layer: dict[str, Any],
    logs: dict[str, list[str]],
    layer_id: str,
) -> dict[str, Any]:
    """Flatten a grammar layer's rules into the channels QGIS can represent."""
    fill_scale = None
    fill_field = None
    stroke_rgba = None
    stroke_width = None
    radius = None
    radius_expr = None

    for rule in grammar_layer.get("rules", []):
        fields = rule.get("fields") or []
        field = fields[0] if fields else None
        for mapping in rule.get("mappings", []):
            channels = set(mapping.get("channels", []))
            scale = mapping.get("scale", {})
            scheme = scale.get("scheme")
            params = scale.get("params", {})

            if channels & _FILL_CHANNELS:
                fill_scale = scale
                fill_field = field
            elif channels & _STROKE_COLOR_CHANNELS:
                if scheme == "constant_rgba":
                    stroke_rgba = params.get("value")
                else:
                    _warn(
                        logs,
                        layer_id,
                        "data-driven stroke color is not supported; "
                        "using a solid stroke.",
                    )
            elif channels & _STROKE_WIDTH_CHANNELS:
                if scheme == "constant_num":
                    stroke_width = params.get("value")
                else:
                    _warn(
                        logs,
                        layer_id,
                        "data-driven stroke width is not supported; "
                        "using a constant width.",
                    )
            elif channels & _RADIUS_CHANNELS:
                if scheme == "constant_num":
                    radius = params.get("value")
                elif scheme == "scalar":
                    # Data-driven radius -> QGIS data-defined marker size.
                    radius_expr = _scalar_size_expr(field, params)
                    output_range = params.get("range")
                    radius = output_range[1] if output_range else params.get("fallback")
                    if radius_expr is None:
                        _warn(
                            logs,
                            layer_id,
                            "data-driven circle radius could not be translated; "
                            "using the maximum radius.",
                        )

    return {
        "fill_scale": fill_scale,
        "fill_field": fill_field,
        "stroke_rgba": stroke_rgba
        if stroke_rgba is not None
        else list(_DEFAULT_STROKE),
        "stroke_width": stroke_width
        if stroke_width is not None
        else _DEFAULT_STROKE_WIDTH,
        "radius": radius if radius is not None else _DEFAULT_RADIUS,
        "radius_expr": radius_expr,
    }


def _make_base_symbol(
    geometry_type: str,
    opacity: float,
    style: dict[str, Any],
):
    """Create a QGIS symbol of the right geometry seeded with stroke/width."""
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

    stroke_color = _rgba_to_qcolor(style["stroke_rgba"])
    stroke_width = style["stroke_width"]

    if geometry_type == "circle":
        symbol_layer.setStrokeColor(stroke_color)
        symbol_layer.setStrokeWidth(stroke_width)
        radius_expr = style.get("radius_expr")
        if radius_expr:
            symbol.setDataDefinedSize(QgsProperty.fromExpression(radius_expr))
    elif geometry_type == "line":
        symbol_layer.setWidth(float(stroke_width))
    elif geometry_type == "fill":
        symbol_layer.setStrokeColor(stroke_color)
        symbol_layer.setStrokeWidth(stroke_width)

    return symbol


def _graduated_renderer(field, params, geometry_type, base_symbol, map_layer, style):
    renderer = QgsGraduatedSymbolRenderer(field)
    renderer.setSourceSymbol(base_symbol.clone())

    name = params.get("name", "viridis")
    reverse = params.get("reverse", False)
    endpoints = sample_colors(name, n=2, reverse=reverse)
    renderer.setSourceColorRamp(
        QgsGradientColorRamp(QColor(*endpoints[0]), QColor(*endpoints[1])),
    )

    color_stops = params.get("colorStops")
    if color_stops and len(color_stops) >= 2:
        for i in range(1, len(color_stops)):
            lower = color_stops[i - 1].get("stop", 0)
            upper = color_stops[i].get("stop", 0)
            rgba = color_stops[i].get("color", _TRANSPARENT)
            range_symbol = base_symbol.clone()
            range_symbol.setColor(_rgba_to_qcolor(rgba))
            if geometry_type == "circle":
                range_symbol.setSize(2 * style["radius"])
            renderer.addClassRange(
                QgsRendererRange(lower, upper, range_symbol, f"{lower} - {upper}"),
            )
    elif map_layer:
        mode = params.get("mode", "equal interval")
        n_classes = int(params.get("nShades", 9))
        renderer.updateClasses(map_layer, _GRADUATED_MODE_MAP.get(mode, 0), n_classes)

    return renderer


def _categorized_renderer(field, params, geometry_type, base_symbol, map_layer, style):
    renderer = QgsCategorizedSymbolRenderer(field)
    color_stops = params.get("colorStops")

    if color_stops:
        for stop in color_stops:
            value = stop.get("stop")
            rgba = stop.get("color", _TRANSPARENT)
            cat_symbol = base_symbol.clone()
            cat_symbol.setColor(_rgba_to_qcolor(rgba))
            if geometry_type == "circle":
                cat_symbol.setSize(2 * style["radius"])
            renderer.addCategory(QgsRendererCategory(value, cat_symbol, str(value)))
    elif map_layer:
        idx = map_layer.fields().indexOf(field)
        unique_values = sorted(map_layer.uniqueValues(idx)) if idx >= 0 else []
        n = max(len(unique_values), 1)
        colors = [
            QColor(*rgba)
            for rgba in sample_colors(
                params.get("colorRamp", "viridis"),
                n=n,
                reverse=params.get("reverse", False),
            )
        ]
        for i, value in enumerate(unique_values):
            cat_symbol = base_symbol.clone()
            cat_symbol.setColor(colors[i])
            if geometry_type == "circle":
                cat_symbol.setSize(2 * style["radius"])
            renderer.addCategory(QgsRendererCategory(value, cat_symbol, str(value)))

    return renderer


def _single_symbol_from_style(style, geometry_type, opacity):
    """Build a single QGIS symbol (constant fill) from a collected style dict."""
    symbol = _make_base_symbol(geometry_type, opacity, style)
    if symbol is None:
        return None
    fill_scale = style["fill_scale"]
    fill_rgba = list(_DEFAULT_FILL)
    if fill_scale and fill_scale.get("scheme") == "constant_rgba":
        fill_rgba = fill_scale["params"].get("value", fill_rgba)
    symbol.setColor(_rgba_to_qcolor(fill_rgba))
    if geometry_type == "circle":
        symbol.setSize(2 * style["radius"])
    return symbol


def _find_color_ramp(grammar_layer):
    """Return a QgsGradientColorRamp from the first colorRamp scale, or None."""
    for rule in grammar_layer.get("rules", []):
        for mapping in rule.get("mappings", []):
            scale = mapping.get("scale", {})
            if scale.get("scheme") == "colorRamp":
                params = scale.get("params", {})
                endpoints = sample_colors(
                    params.get("name", "viridis"),
                    n=2,
                    reverse=params.get("reverse", False),
                )
                return QgsGradientColorRamp(
                    QColor(*endpoints[0]),
                    QColor(*endpoints[1]),
                )
    return None


def _build_inner_renderer(
    grammar_layer,
    geometry_type,
    opacity,
    map_layer,
    logs,
    layer_id,
):
    """Single Symbol / Graduated / Categorized renderer for one grammar layer."""
    style = _collect_vector_style(grammar_layer, logs, layer_id)
    base_symbol = _make_base_symbol(geometry_type, opacity, style)
    if base_symbol is None:
        return None

    fill_scale = style["fill_scale"]
    fill_field = style["fill_field"]
    scheme = fill_scale.get("scheme") if fill_scale else None

    if scheme == "colorRamp" and fill_field:
        return _graduated_renderer(
            fill_field,
            fill_scale["params"],
            geometry_type,
            base_symbol,
            map_layer,
            style,
        )
    if scheme == "categorical" and fill_field:
        return _categorized_renderer(
            fill_field,
            fill_scale["params"],
            geometry_type,
            base_symbol,
            map_layer,
            style,
        )

    return QgsSingleSymbolRenderer(
        _single_symbol_from_style(style, geometry_type, opacity),
    )


def _heatmap_renderer(grammar_layer, logs, layer_id):
    """Map a KDE preprocess transform to a QgsHeatmapRenderer (points only)."""
    kde = next(
        (t for t in grammar_layer.get("preprocess", []) if t.get("type") == "kde"),
        {},
    )
    renderer = QgsHeatmapRenderer()
    renderer.setRadius(kde.get("radius", 10))
    renderer.setRadiusUnit(Qgis.RenderUnit.Pixels)
    weight_field = kde.get("weightField")
    if weight_field and not str(weight_field).startswith("$"):
        renderer.setWeightExpression(f'"{weight_field}"')
    ramp = _find_color_ramp(grammar_layer)
    if ramp is not None:
        renderer.setColorRamp(ramp)
    return renderer


def _cluster_renderer(preprocess, inner_renderer, logs, layer_id):
    """Wrap an inner renderer in a QgsPointClusterRenderer (points only)."""
    cluster = next((t for t in preprocess if t.get("type") == "cluster"), {})
    renderer = QgsPointClusterRenderer()
    if inner_renderer is not None:
        renderer.setEmbeddedRenderer(inner_renderer)
    renderer.setTolerance(cluster.get("radius", 10))
    renderer.setToleranceUnit(Qgis.RenderUnit.Pixels)
    return renderer


def _rule_based_renderer(
    grammar_layer,
    geometry_type,
    opacity,
    map_layer,
    logs,
    layer_id,
):
    """Map rule-level `when` predicates to a QgsRuleBasedRenderer.

    Unconditional rules form a base style; each guarded rule becomes a QGIS rule
    with a filter expression and a single symbol (base + the rule's own colours).
    Field-driven colour scales inside a guarded rule are approximated to a
    constant, with a warning.
    """
    rules = grammar_layer.get("rules", [])
    base_rules = [r for r in rules if not r.get("when")]
    guarded_rules = [r for r in rules if r.get("when")]

    root = QgsRuleBasedRenderer.Rule(None)

    for guarded in guarded_rules:
        merged = {"rules": [*base_rules, guarded]}
        style = _collect_vector_style(merged, logs, layer_id)
        if style["fill_scale"] and style["fill_scale"].get("scheme") not in (
            "constant_rgba",
            None,
        ):
            _warn(
                logs,
                layer_id,
                "a field-driven colour inside a `when` rule was approximated "
                "to a constant colour.",
            )
        symbol = _single_symbol_from_style(style, geometry_type, opacity)
        expr = _when_to_expr(guarded["when"], guarded.get("whenOp", "all")) or ""
        root.appendChild(QgsRuleBasedRenderer.Rule(symbol, filterExp=expr))

    if base_rules:
        base_style = _collect_vector_style({"rules": base_rules}, logs, layer_id)
        base_symbol = _single_symbol_from_style(base_style, geometry_type, opacity)
        else_rule = QgsRuleBasedRenderer.Rule(base_symbol)
        else_rule.setIsElse(True)
        root.appendChild(else_rule)

    return QgsRuleBasedRenderer(root)


def grammar_layer_to_renderer(
    grammar_layer: dict[str, Any],
    geometry_type: str,
    opacity: float,
    map_layer,
    logs: dict[str, list[str]],
    layer_id: str,
):
    """Build a QGIS renderer for a single grammar rendering layer, or None.

    Routes KDE/cluster ``preprocess`` to heatmap/cluster renderers and rule-level
    ``when`` predicates to a rule-based renderer; otherwise builds a plain
    Single Symbol / Graduated / Categorized renderer.
    """
    preprocess = grammar_layer.get("preprocess") or []
    has_kde = any(t.get("type") == "kde" for t in preprocess)
    has_cluster = any(t.get("type") == "cluster" for t in preprocess)
    has_rule_when = any(r.get("when") for r in grammar_layer.get("rules", []))

    if has_kde:
        return _heatmap_renderer(grammar_layer, logs, layer_id)

    if has_rule_when:
        inner = _rule_based_renderer(
            grammar_layer,
            geometry_type,
            opacity,
            map_layer,
            logs,
            layer_id,
        )
    else:
        inner = _build_inner_renderer(
            grammar_layer,
            geometry_type,
            opacity,
            map_layer,
            logs,
            layer_id,
        )

    if has_cluster and inner is not None:
        return _cluster_renderer(preprocess, inner, logs, layer_id)
    return inner


def grammar_to_flat_colors(symbology_state: dict[str, Any]) -> dict[str, list]:
    """Extract constant per-channel colors from grammar (for vector tile export)."""
    colors: dict[str, list] = {}
    for grammar_layer in symbology_state.get("layers") or []:
        for rule in grammar_layer.get("rules", []):
            for mapping in rule.get("mappings", []):
                scale = mapping.get("scale", {})
                if scale.get("scheme") != "constant_rgba":
                    continue
                value = scale.get("params", {}).get("value")
                for channel in mapping.get("channels", []):
                    colors.setdefault(channel, value)
    return colors


def grammar_to_raster_renderer(
    symbology_state: dict[str, Any],
    data_provider,
    logs: dict[str, list[str]],
    layer_id: str,
):
    """Build a QgsSingleBandPseudoColorRenderer from Grammar.

    Returns ``(renderer, vmin, vmax)`` or None when there is no pixel colorRamp
    mapping.
    """
    color_params = None
    band = 1
    alpha_present = False

    for grammar_layer in symbology_state.get("layers") or []:
        if grammar_layer.get("preprocess"):
            _warn(
                logs,
                layer_id,
                "a raster preprocess transform was dropped (no QGIS equivalent).",
            )
        for rule in grammar_layer.get("rules", []):
            rule_band = _parse_band(rule.get("fields") or [])
            for mapping in rule.get("mappings", []):
                channels = set(mapping.get("channels", []))
                scale = mapping.get("scale", {})
                if (
                    channels & _PIXEL_COLOR_CHANNELS
                    and scale.get("scheme") == "colorRamp"
                ):
                    color_params = scale.get("params", {})
                    if rule_band is not None:
                        band = rule_band
                elif channels & _PIXEL_ALPHA_CHANNELS:
                    alpha_present = True

    if color_params is None:
        return None

    if alpha_present:
        _warn(
            logs,
            layer_id,
            "a separate pixel-alpha mapping was dropped; "
            "alpha is taken from the color ramp.",
        )

    name = color_params.get("name", "viridis")
    reverse = color_params.get("reverse", False)
    domain = color_params.get("domain")
    color_stops = color_params.get("colorStops")
    n_shades = int(color_params.get("nShades", 9))

    shader = QgsColorRampShader()
    shader.setColorRampType(QgsColorRampShader.Interpolated)
    items = []

    if color_stops and len(color_stops) >= 2:
        items.extend(
            QgsColorRampShader.ColorRampItem(
                stop.get("stop", 0),
                _rgba_to_qcolor(stop.get("color", _TRANSPARENT)),
            )
            for stop in color_stops
        )
        vmin = domain[0] if domain else color_stops[0].get("stop", 0)
        vmax = domain[1] if domain else color_stops[-1].get("stop", 0)
    else:
        vmin, vmax = domain or (0.0, 1.0)
        colors = sample_colors(name, n=max(n_shades, 2), reverse=reverse)
        for i, color in enumerate(colors):
            value = vmin + (vmax - vmin) * i / max(len(colors) - 1, 1)
            items.append(QgsColorRampShader.ColorRampItem(value, QColor(*color)))

    shader.setColorRampItemList(items)
    shader.setClip(True)
    raster_shader = QgsRasterShader()
    raster_shader.setRasterShaderFunction(shader)

    renderer = QgsSingleBandPseudoColorRenderer(data_provider, band, raster_shader)
    renderer.setClassificationMin(vmin)
    renderer.setClassificationMax(vmax)
    return renderer, vmin, vmax
