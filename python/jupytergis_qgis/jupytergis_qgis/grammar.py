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
    QgsContrastEnhancement,
    QgsFillSymbol,
    QgsGradientColorRamp,
    QgsGraduatedSymbolRenderer,
    QgsHeatmapRenderer,
    QgsLineSymbol,
    QgsMarkerSymbol,
    QgsMultiBandColorRenderer,
    QgsPointClusterRenderer,
    QgsProperty,
    QgsRasterShader,
    QgsRendererCategory,
    QgsRendererRange,
    QgsRuleBasedRenderer,
    QgsSingleBandPseudoColorRenderer,
    QgsSingleSymbolRenderer,
    QgsSymbolLayer,
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
# Multiband RGB sub-channel -> color index (red=0, green=1, blue=2).
_PIXEL_BAND_CHANNELS = {"pixel-red": 0, "pixel-green": 1, "pixel-blue": 2}

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
    if isinstance(rgba, list | tuple) and len(rgba) == 4:
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


def _normalize(value: float, vmin: float, vmax: float) -> float:
    """Map a raw raster value to the [0, 1] space JupyterGIS colorRamps use.

    JupyterGIS renders GeoTIFF bands normalized to [0, 1] (source min/max do the
    scaling), so grammar colorRamp stops live in [0, 1] — not raw value space.
    """
    if vmax == vmin:
        return 0.0
    return (value - vmin) / (vmax - vmin)


def _denormalize(value: float, vmin: float, vmax: float) -> float:
    """Inverse of :func:`_normalize`: a [0, 1] stop back to a raw QGIS value."""
    return vmin + value * (vmax - vmin)


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
    color_stops: list | None = None,
) -> dict[str, Any]:
    """Grammar for a graduated (colorRamp on numeric field) style.

    ``color_stops`` (``[{"stop": value, "color": rgba}, ...]``) pins the exact
    per-class breaks/colors; without it the ramp is recomputed from the data.
    """
    params: dict[str, Any] = {
        "name": color_ramp,
        "nShades": n_classes,
        "mode": mode,
        "reverse": reverse,
        "fallback": list(_TRANSPARENT),
    }
    if color_stops:
        params["colorStops"] = color_stops
    color_ramp_scale = {"scheme": "colorRamp", "params": params}
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
    color_stops: list | None = None,
) -> dict[str, Any]:
    """Grammar for a categorized (categorical scale on a field) style.

    ``color_stops`` (``[{"stop": value, "color": rgba}, ...]``) pins the exact
    per-category colors; without it categories are colored from the ramp.
    """
    params: dict[str, Any] = {
        "colorRamp": color_ramp,
        "reverse": reverse,
        "fallback": list(_TRANSPARENT),
    }
    if color_stops:
        params["colorStops"] = color_stops
    categorical_scale = {"scheme": "categorical", "params": params}
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


def raster_flat_color_to_grammar(color: Any) -> dict[str, Any]:
    """Migrate a legacy OpenLayers raster ``color`` expression to Grammar.

    Pre-Grammar GeoTiff layers stored symbology as an OL ``interpolate``
    expression, e.g. ``["interpolate", ["linear"], ["band", 1], stop, rgba, ...]``.
    Fold its (stop, color) pairs into a single-band pseudocolor ``pixel-color``
    colorRamp (stops are already in normalized [0, 1] band space). Returns an
    empty symbology state when ``color`` is not a recognised interpolate.
    """
    if not isinstance(color, list) or len(color) < 5 or color[0] != "interpolate":
        return {"layers": []}

    band = 1
    band_expr = color[2]
    if isinstance(band_expr, list) and len(band_expr) >= 2 and band_expr[0] == "band":
        try:
            band = int(band_expr[1])
        except (TypeError, ValueError):
            band = 1

    color_stops = []
    pairs = color[3:]
    for i in range(0, len(pairs) - 1, 2):
        stop, rgba = pairs[i], pairs[i + 1]
        if not isinstance(stop, int | float) or not isinstance(rgba, list):
            continue
        color_stops.append(
            {"stop": float(stop), "color": [float(component) for component in rgba]},
        )

    if len(color_stops) < 2:
        return {"layers": []}

    params = {
        "name": "custom",
        "domain": [0.0, 1.0],
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


def raster_to_grammar(
    color_ramp_items: list,
    band: int,
    source_min: float,
    source_max: float,
) -> dict[str, Any]:
    """Grammar for a single-band pseudocolor raster from QGIS color ramp items.

    QGIS discrete/exact ramps are approximated as an interpolated colorRamp; the
    explicit ``colorStops`` preserve the exact value→color pairs either way.
    QGIS ramp values are raw; they are normalized to [0, 1] (via source min/max)
    to match the space JupyterGIS colorRamps render in.
    """
    color_stops = []
    for node in color_ramp_items:
        value = node.value
        if value in (float("inf"), float("-inf")):
            continue
        color_stops.append(
            {
                "stop": _normalize(value, source_min, source_max),
                "color": _qcolor_to_rgba(node.color),
            },
        )

    params = {
        "name": "custom",
        "domain": [0.0, 1.0],
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


def grayscale_raster_to_grammar(band: int) -> dict[str, Any]:
    """Grammar for a single-band grey raster (a black->white colorRamp).

    QGIS's default single-band renderer is greyscale; express it as a pixel-color
    ramp so JupyterGIS displays it (and it round-trips back to a single-band
    pseudocolor renderer). Stops are in normalized [0, 1] space — the source
    min/max handle the raw-value scaling — so the band actually spans the ramp.
    """
    params = {
        "name": "custom",
        "domain": [0.0, 1.0],
        "nShades": 2,
        "mode": "equal interval",
        "reverse": False,
        "fallback": list(_TRANSPARENT),
        "colorStops": [
            {"stop": 0.0, "color": [0.0, 0.0, 0.0, 1.0]},
            {"stop": 1.0, "color": [255.0, 255.0, 255.0, 1.0]},
        ],
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


def multiband_raster_to_grammar(
    bands: dict[int, int],
    ranges: dict[int, tuple[float, float]] | None = None,
    alpha_band: int | None = None,
) -> dict[str, Any]:
    """Grammar for a multiband RGB raster from QGIS band assignments.

    ``bands`` maps a color index (0=red, 1=green, 2=blue) to a QGIS band number.
    ``ranges`` optionally maps the same index to a (min, max) contrast stretch —
    present bands get a ``scalar`` rescale, absent ones an ``identity`` pass.
    ``alpha_band`` (a dedicated mask band) becomes a ``pixel-alpha`` mapping so
    the transparency round-trips back to a QGIS alpha band on re-export.
    """
    ranges = ranges or {}
    index_to_channel = {0: "pixel-red", 1: "pixel-green", 2: "pixel-blue"}
    rules = []
    for index in sorted(bands):
        band = bands[index]
        if band is None or band < 1:
            continue
        stretch = ranges.get(index)
        if stretch is not None:
            scale = {
                "scheme": "scalar",
                "params": {
                    "domain": [float(stretch[0]), float(stretch[1])],
                    "range": [0.0, 255.0],
                    "fallback": 0.0,
                },
            }
        else:
            scale = {"scheme": "identity", "params": {}}
        rules.append(
            {
                "id": _new_id(),
                "fields": [f"$band-{int(band)}"],
                "mappings": [
                    {"scale": scale, "channels": [index_to_channel[index]]},
                ],
            },
        )
    if alpha_band is not None and alpha_band >= 1:
        rules.append(
            {
                "id": _new_id(),
                "fields": [f"$band-{int(alpha_band)}"],
                "mappings": [
                    {
                        "scale": {"scheme": "identity", "params": {}},
                        "channels": ["pixel-alpha"],
                    },
                ],
            },
        )
    return {"layers": [{"id": _new_id(), "rules": rules}]}


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
def _scale_linear_expr(field: str | None, params: dict[str, Any]) -> str | None:
    """QGIS ``scale_linear`` expression for a scalar scale, or None.

    ``scale_linear`` is the single QGIS built-in we emit; it round-trips through
    a ``QgsProperty`` and is recognised again on import.
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
    return f'scale_linear("{field}", {d0}, {d1}, {r0}, {r1})'


def _scalar_size_expr(field: str | None, params: dict[str, Any]) -> str | None:
    """Data-defined marker-size expression for a scalar circle-radius scale.

    Grammar circle-radius is a radius; a QGIS marker's size is the diameter, so
    the linear mapping is doubled.
    """
    expr = _scale_linear_expr(field, params)
    return f"2 * {expr}" if expr else None


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
    """Flatten a grammar layer's rules into the channels QGIS can represent.

    Constant channels become plain symbol properties; data-driven stroke colour
    / width / radius become ``QgsProperty`` overrides (field reference for
    ``identity``, ``scale_linear`` for ``scalar``) that QGIS serialises and
    reads back natively.
    """
    fill_scale = None
    fill_field = None
    stroke_rgba = None
    stroke_width = None
    radius = None
    stroke_color_prop = None
    stroke_width_prop = None
    radius_prop = None

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
                elif scheme == "identity" and field:
                    stroke_color_prop = QgsProperty.fromField(field)
                else:
                    _warn(
                        logs,
                        layer_id,
                        "data-driven stroke color could not be translated; "
                        "using a solid stroke.",
                    )
            elif channels & _STROKE_WIDTH_CHANNELS:
                if scheme == "constant_num":
                    stroke_width = params.get("value")
                elif scheme == "identity" and field:
                    stroke_width_prop = QgsProperty.fromField(field)
                elif scheme == "scalar":
                    expr = _scale_linear_expr(field, params)
                    if expr:
                        stroke_width_prop = QgsProperty.fromExpression(expr)
                    else:
                        _warn(
                            logs,
                            layer_id,
                            "data-driven stroke width could not be translated; "
                            "using a constant width.",
                        )
                else:
                    _warn(
                        logs,
                        layer_id,
                        "data-driven stroke width could not be translated; "
                        "using a constant width.",
                    )
            elif channels & _RADIUS_CHANNELS:
                if scheme == "constant_num":
                    radius = params.get("value")
                elif scheme == "identity" and field:
                    radius_prop = QgsProperty.fromField(field)
                elif scheme == "scalar":
                    # Data-driven radius -> QGIS data-defined marker size.
                    expr = _scalar_size_expr(field, params)
                    output_range = params.get("range")
                    radius = output_range[1] if output_range else params.get("fallback")
                    if expr:
                        radius_prop = QgsProperty.fromExpression(expr)
                    else:
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
        "stroke_color_prop": stroke_color_prop,
        "stroke_width_prop": stroke_width_prop,
        "radius_prop": radius_prop,
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
    stroke_color_prop = style.get("stroke_color_prop")
    stroke_width_prop = style.get("stroke_width_prop")
    radius_prop = style.get("radius_prop")

    if geometry_type == "circle":
        symbol_layer.setStrokeColor(stroke_color)
        symbol_layer.setStrokeWidth(stroke_width)
        if radius_prop is not None:
            symbol.setDataDefinedSize(radius_prop)
    elif geometry_type == "line":
        symbol_layer.setWidth(float(stroke_width))
    elif geometry_type == "fill":
        symbol_layer.setStrokeColor(stroke_color)
        symbol_layer.setStrokeWidth(stroke_width)

    if stroke_color_prop is not None:
        symbol_layer.setDataDefinedProperty(
            QgsSymbolLayer.PropertyStrokeColor,
            stroke_color_prop,
        )
    if stroke_width_prop is not None:
        symbol_layer.setDataDefinedProperty(
            QgsSymbolLayer.PropertyStrokeWidth,
            stroke_width_prop,
        )

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


def _to_rule_based(inner):
    """Convert a native vector renderer to rule-based using QGIS itself.

    QGIS generates the per-class rules, filters and symbols via
    ``convertFromRenderer``; we never hand-write classification expressions.
    Returns the native renderer unchanged if QGIS cannot convert it, and None
    when there is nothing to convert.
    """
    if inner is None:
        return None
    # Graduated renderers lose their outer domain bounds when QGIS converts them
    # to rule-based: QGIS >= 3.44
    if isinstance(inner, QgsGraduatedSymbolRenderer):
        return inner
    converted = QgsRuleBasedRenderer.convertFromRenderer(inner)
    # An unclassified categorized renderer (data couldn't load, so no categories
    # materialised) converts to an empty rule set, which would drop the
    # classification field. Keep the native renderer in that case — it still
    # carries the field/scheme, and import handles it either way.
    if converted is None or not converted.rootRule().children():
        return inner
    return converted


def _append_converted_children(parent, inner) -> None:
    """Append the rules QGIS produces for ``inner`` as children of ``parent``."""
    if inner is None:
        return
    converted = QgsRuleBasedRenderer.convertFromRenderer(inner)
    if converted is None:
        return
    for child in list(converted.rootRule().children()):
        parent.appendChild(child.clone())


def _assemble_rule_based(
    base_rules,
    guarded_rules,
    geometry_type,
    opacity,
    map_layer,
    logs,
    layer_id,
):
    """Build a QgsRuleBasedRenderer honouring rule-level ``when`` predicates.

    Unguarded rules form the default branch; each guarded rule's full symbology
    (graduated/categorized/single) is built natively, converted by QGIS, and
    nested under a parent rule carrying the ``when`` filter. QGIS ANDs the
    nested filters at render time, so a guarded rule keeps its full field-driven
    colours instead of being flattened to a constant.
    """
    root = QgsRuleBasedRenderer.Rule(None)

    if base_rules:
        base_inner = _build_inner_renderer(
            {"rules": base_rules},
            geometry_type,
            opacity,
            map_layer,
            logs,
            layer_id,
        )
        _append_converted_children(root, base_inner)

    for guarded in guarded_rules:
        merged = {"rules": [*base_rules, guarded]}
        inner = _build_inner_renderer(
            merged,
            geometry_type,
            opacity,
            map_layer,
            logs,
            layer_id,
        )
        expr = _when_to_expr(guarded["when"], guarded.get("whenOp", "all")) or ""
        parent = QgsRuleBasedRenderer.Rule(None, filterExp=expr)
        _append_converted_children(parent, inner)
        root.appendChild(parent)

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

    Vector-symbol layers are always emitted as a QgsRuleBasedRenderer: the
    symbology is built with native renderer classes (Single/Graduated/
    Categorized) and converted by QGIS via ``convertFromRenderer``. KDE
    (heatmap) and cluster layers keep their dedicated renderers, which QGIS
    cannot express as rules.
    """
    preprocess = grammar_layer.get("preprocess") or []
    has_kde = any(t.get("type") == "kde" for t in preprocess)
    has_cluster = any(t.get("type") == "cluster" for t in preprocess)

    if has_kde:
        return _heatmap_renderer(grammar_layer, logs, layer_id)

    rules = grammar_layer.get("rules", [])
    guarded_rules = [r for r in rules if r.get("when")]

    if guarded_rules:
        base_rules = [r for r in rules if not r.get("when")]
        renderer = _assemble_rule_based(
            base_rules,
            guarded_rules,
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
        renderer = _to_rule_based(inner)

    if has_cluster and renderer is not None:
        return _cluster_renderer(preprocess, renderer, logs, layer_id)
    return renderer


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


def _multiband_color_renderer(
    multiband: dict[int, tuple[int, dict[str, Any]]],
    alpha_band: int | None,
    data_provider,
    logs: dict[str, list[str]],
    layer_id: str,
):
    """Build a QgsMultiBandColorRenderer from pixel-red/green/blue band mappings.

    A ``scalar`` scale on a band becomes a per-band contrast stretch; a dedicated
    ``pixel-alpha`` band becomes the renderer's alpha band. Returns
    ``(renderer, None, None)`` to match the raster renderer signature.
    """
    red = multiband.get(0, (1, {}))[0]
    green = multiband.get(1, (2, {}))[0]
    blue = multiband.get(2, (3, {}))[0]

    renderer = QgsMultiBandColorRenderer(data_provider, red, green, blue)
    if (
        alpha_band is not None
        and alpha_band >= 1
        and alpha_band
        not in (
            red,
            green,
            blue,
        )
    ):
        renderer.setAlphaBand(alpha_band)

    setters = {
        0: renderer.setRedContrastEnhancement,
        1: renderer.setGreenContrastEnhancement,
        2: renderer.setBlueContrastEnhancement,
    }
    for index, (band, scale) in multiband.items():
        if scale.get("scheme") != "scalar" or data_provider is None:
            continue
        domain = scale.get("params", {}).get("domain")
        if not domain or len(domain) != 2:
            continue
        dtype = data_provider.dataType(band)
        if dtype == Qgis.DataType.UnknownDataType:
            _warn(
                logs,
                layer_id,
                "could not apply a band contrast stretch (raster data unavailable).",
            )
            continue
        enhancement = QgsContrastEnhancement(dtype)
        enhancement.setMinimumValue(float(domain[0]))
        enhancement.setMaximumValue(float(domain[1]))
        enhancement.setContrastEnhancementAlgorithm(
            QgsContrastEnhancement.StretchToMinimumMaximum,
        )
        setters[index](enhancement)

    return renderer, None, None


def grammar_to_raster_renderer(
    symbology_state: dict[str, Any],
    data_provider,
    logs: dict[str, list[str]],
    layer_id: str,
    source_min: float | None = None,
    source_max: float | None = None,
):
    """Build a raster renderer from Grammar.

    ``source_min``/``source_max`` are the raster source's normalization range;
    grammar colorRamp stops (normalized [0, 1]) are scaled back to raw values so
    QGIS classifies on the real band range.

    Returns a ``QgsMultiBandColorRenderer`` for pixel-red/green/blue band
    mappings, otherwise a ``QgsSingleBandPseudoColorRenderer`` from a pixel-color
    colorRamp. The result is ``(renderer, vmin, vmax)`` (vmin/vmax are ``None``
    for multiband), or ``None`` when there is no recognised pixel mapping.
    """
    color_params = None
    band = 1
    alpha_present = False
    # Band referenced by a pixel-alpha mapping, when it is a dedicated mask band
    # (``$band-N``). Used as the QGIS alpha band for multiband RGB rasters.
    alpha_band: int | None = None
    # color index (0=red,1=green,2=blue) -> (band, scale) for multiband RGB.
    multiband: dict[int, tuple[int, dict[str, Any]]] = {}

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
                    if rule_band is not None:
                        alpha_band = rule_band
                else:
                    for channel in channels & _PIXEL_BAND_CHANNELS.keys():
                        if rule_band is not None:
                            multiband[_PIXEL_BAND_CHANNELS[channel]] = (
                                rule_band,
                                scale,
                            )

    # Multiband RGB takes priority: a pixel-red/green/blue mapping cannot be
    # expressed by a single-band pseudocolor ramp.
    if multiband:
        return _multiband_color_renderer(
            multiband,
            alpha_band,
            data_provider,
            logs,
            layer_id,
        )

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

    # Grammar stops/domain are normalized [0, 1]; scale them back to raw band
    # values for QGIS (a no-op when the source range is unknown).
    if source_min is not None and source_max is not None:

        def _raw(value: float) -> float:
            return _denormalize(value, source_min, source_max)
    else:

        def _raw(value: float) -> float:
            return value

    shader = QgsColorRampShader()
    shader.setColorRampType(QgsColorRampShader.Interpolated)
    items = []

    if color_stops and len(color_stops) >= 2:
        items.extend(
            QgsColorRampShader.ColorRampItem(
                _raw(stop.get("stop", 0)),
                _rgba_to_qcolor(stop.get("color", _TRANSPARENT)),
            )
            for stop in color_stops
        )
        vmin = _raw(domain[0] if domain else color_stops[0].get("stop", 0))
        vmax = _raw(domain[1] if domain else color_stops[-1].get("stop", 0))
    else:
        norm_min, norm_max = domain or (0.0, 1.0)
        vmin, vmax = _raw(norm_min), _raw(norm_max)
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
