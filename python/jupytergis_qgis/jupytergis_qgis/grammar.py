from __future__ import annotations

import re
import uuid
from typing import Any

from jupytergis_core.color_ramps import sample_colors
from jupytergis_core.colors import hex_to_rgba
from PyQt5.QtGui import QColor
from qgis.core import (  # type: ignore[import-untyped]
    Qgis,
    QgsColorRampShader,
    QgsContrastEnhancement,
    QgsFillSymbol,
    QgsGradientColorRamp,
    QgsGradientStop,
    QgsHeatmapRenderer,
    QgsLineSymbol,
    QgsMarkerSymbol,
    QgsMultiBandColorRenderer,
    QgsPointClusterRenderer,
    QgsProperty,
    QgsRasterShader,
    QgsSingleBandPseudoColorRenderer,
    QgsSymbolLayer,
)
from qgis.PyQt import sip

# Grammar defaults, mirroring packages/schema/src/grammar/grammarConversions.ts
# and python/jupytergis_core/.../migrations/v0_5_to_v0_6.py so import output stays
# consistent with the frontend migration.
_DEFAULT_STROKE_WIDTH = 1.25
_DEFAULT_FILL = [255.0, 255.0, 255.0, 0.4]
_DEFAULT_STROKE = [51.0, 153.0, 204.0, 1.0]
_DEFAULT_RADIUS = 5.0
_TRANSPARENT = [0.0, 0.0, 0.0, 0.0]
_OL_CANVAS_STROKE = [0.0, 0.0, 0.0, 1.0]
# Number of gradient stops sampled for an exported heatmap colour ramp.
_HEATMAP_RAMP_STOPS = 9

# Channel groups (see packages/schema/src/_interface/project/symbology.d.ts).
_FILL_CHANNELS = {"fill-color", "circle-fill-color"}
_STROKE_COLOR_CHANNELS = {"stroke-color", "circle-stroke-color"}
_STROKE_WIDTH_CHANNELS = {"stroke-width", "circle-stroke-width"}
_RADIUS_CHANNELS = {"circle-radius"}
_PIXEL_COLOR_CHANNELS = {"pixel-color", "pixel-rgb"}
_PIXEL_ALPHA_CHANNELS = {"pixel-alpha"}
# Multiband RGB sub-channel -> color index (red=0, green=1, blue=2).
_PIXEL_BAND_CHANNELS = {"pixel-red": 0, "pixel-green": 1, "pixel-blue": 2}


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
def _stroke_size_mappings(
    stroke: list,
    stroke_width: float,
    radius: float,
) -> list[dict[str, Any]]:
    """The constant stroke-colour / stroke-width / radius mappings shared by every
    vector style builder (they differ only in their fill mapping).
    """
    return [
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


def _line_width_mapping(stroke_width: float) -> dict[str, Any]:
    """The constant stroke-width mapping for a line (its only size channel)."""
    return {
        "scale": {"scheme": "constant_num", "params": {"value": stroke_width}},
        "channels": ["stroke-width"],
    }


def _color_mapping(scale: dict[str, Any], geometry: str) -> dict[str, Any]:
    """A colour mapping on the channel that carries a geometry's colour.

    A line's colour is its stroke; polygons/points colour their fill.
    """
    channels = (
        ["stroke-color"] if geometry == "line" else ["fill-color", "circle-fill-color"]
    )
    return {"scale": scale, "channels": channels}


def single_symbol_grammar(
    fill: list,
    stroke: list,
    stroke_width: float,
    radius: float,
    geometry: str = "fill",
) -> dict[str, Any]:
    """Grammar for a constant (Single Symbol) style."""
    if geometry == "line":
        mappings = [
            _color_mapping(
                {"scheme": "constant_rgba", "params": {"value": stroke}},
                geometry,
            ),
            _line_width_mapping(stroke_width),
        ]
    else:
        mappings = [
            _color_mapping(
                {"scheme": "constant_rgba", "params": {"value": fill}},
                geometry,
            ),
            *_stroke_size_mappings(stroke, stroke_width, radius),
        ]
    rule = {"id": _new_id(), "mappings": mappings}
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
    geometry: str = "fill",
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
    if geometry == "line":
        mappings = [
            _color_mapping(color_ramp_scale, geometry),
            _line_width_mapping(stroke_width),
        ]
    else:
        mappings = [
            _color_mapping(color_ramp_scale, geometry),
            *_stroke_size_mappings(stroke, stroke_width, radius),
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
    geometry: str = "fill",
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
    if geometry == "line":
        mappings = [
            _color_mapping(categorical_scale, geometry),
            _line_width_mapping(stroke_width),
        ]
    else:
        mappings = [
            _color_mapping(categorical_scale, geometry),
            *_stroke_size_mappings(stroke, stroke_width, radius),
        ]
    rule: dict[str, Any] = {"id": _new_id(), "mappings": mappings}
    if field:
        rule["fields"] = [field]
    return {"layers": [{"id": _new_id(), "rules": [rule]}]}


def _single_band_pseudocolor_grammar(band: int, color_stops: list) -> dict[str, Any]:
    """A single-band pseudocolor ``pixel-color`` colorRamp grammar.

    Shared skeleton for every single-band raster import; ``color_stops`` are in
    normalized [0, 1] band space (the source min/max handle the raw scaling).
    """
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
    return _single_band_pseudocolor_grammar(band, color_stops)


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
    color_stops = [
        {
            "stop": _normalize(node.value, source_min, source_max),
            "color": _qcolor_to_rgba(node.color),
        }
        for node in color_ramp_items
        if node.value not in (float("inf"), float("-inf"))
    ]
    return _single_band_pseudocolor_grammar(band, color_stops)


def grayscale_raster_to_grammar(band: int) -> dict[str, Any]:
    """Grammar for a single-band grey raster (a black->white colorRamp).

    QGIS's default single-band renderer is greyscale; express it as a pixel-color
    ramp so JupyterGIS displays it (and it round-trips back to a single-band
    pseudocolor renderer). Stops are in normalized [0, 1] space — the source
    min/max handle the raw-value scaling — so the band actually spans the ramp.
    """
    return _single_band_pseudocolor_grammar(
        band,
        [
            {"stop": 0.0, "color": [0.0, 0.0, 0.0, 1.0]},
            {"stop": 1.0, "color": [255.0, 255.0, 255.0, 1.0]},
        ],
    )


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
    half = radius / 2.0
    kde: dict[str, Any] = {"type": "kde", "radius": half, "blur": half}
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

    # Only accept a value that is a *complete* literal. Bare quote-bookended
    # matching (raw[0] == raw[-1] == "'") would treat a compound expression like
    # ``'x' OR "b" = 'y'`` as one string and emit a bogus predicate; require every
    # interior quote to be doubled so only a genuine single literal is parsed.
    if re.fullmatch(r"'(?:[^']|'')*'", raw):
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
    stroke_scale = None
    stroke_field = None
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
                elif scheme in ("categorical", "colorRamp") and field:
                    # A data-driven stroke colour (e.g. roads coloured by type).
                    # For a line this IS the layer's colour and becomes a
                    # categorized/graduated renderer; _build_inner_renderer picks
                    # it up via stroke_scale for line geometry.
                    stroke_scale = scale
                    stroke_field = field
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
        "stroke_scale": stroke_scale,
        "stroke_field": stroke_field,
        "stroke_rgba": stroke_rgba
        if stroke_rgba is not None
        else list(_OL_CANVAS_STROKE),
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


def _heatmap_color_ramp(grammar_layer):
    """A QGIS heatmap gradient from the layer's colorRamp scale, or None.

    Alpha ramps from 0 (transparent) at low density to opaque at high density: a
    QGIS heatmap maps density 0 -> the ramp's first colour, so an opaque first
    colour paints the whole extent (the heatmap "covering the map"). The hues come
    from the named ramp (e.g. viridis) so hotspots read as the expected colours.
    """
    for rule in grammar_layer.get("rules", []):
        for mapping in rule.get("mappings", []):
            scale = mapping.get("scale", {})
            if scale.get("scheme") != "colorRamp":
                continue
            params = scale.get("params", {})
            colors = sample_colors(
                params.get("name", "viridis"),
                n=_HEATMAP_RAMP_STOPS,
                reverse=params.get("reverse", False),
            )
            last = _HEATMAP_RAMP_STOPS - 1

            def _stop_color(i: int, colors: list = colors, last: int = last) -> QColor:
                r, g, b = colors[i][0], colors[i][1], colors[i][2]
                alpha = round(255 * min(1.0, 4 * i / last))
                return QColor(int(r), int(g), int(b), alpha)

            ramp = QgsGradientColorRamp(_stop_color(0), _stop_color(last))
            ramp.setStops(
                [QgsGradientStop(i / last, _stop_color(i)) for i in range(1, last)],
            )
            return ramp
    return None


def _heatmap_renderer(grammar_layer):
    """Map a KDE preprocess transform to a QgsHeatmapRenderer (points only)."""
    kde = next(
        (t for t in grammar_layer.get("preprocess", []) if t.get("type") == "kde"),
        {},
    )
    renderer = QgsHeatmapRenderer()
    # QGIS has a single kernel radius; the OpenLayers `blur` is a separate spread,
    # so fold it in (radius + blur) to approximate the frontend's smoothness.
    renderer.setRadius(kde.get("radius", 10) + kde.get("blur", 0))
    renderer.setRadiusUnit(Qgis.RenderUnit.Pixels)
    renderer.setRenderQuality(1)
    weight_field = kde.get("weightField")
    if weight_field and not str(weight_field).startswith("$"):
        renderer.setWeightExpression(f'"{weight_field}"')
    ramp = _heatmap_color_ramp(grammar_layer)
    if ramp is not None:
        renderer.setColorRamp(ramp)
        # QgsHeatmapRenderer.setColorRamp() takes ownership of the raw pointer
        # (mGradientRamp.reset(ramp)), but sip still thinks Python owns `ramp`.
        # On a large layer, GC can run before project.write() and free it,
        # leaving QGIS to serialise a degraded 2-stop opaque ramp (the heatmap
        # then paints the whole map). Hand ownership to C++ so Python won't.
        sip.transferto(ramp, None)
    return renderer


def _cluster_renderer(preprocess, inner_renderer):
    """Wrap an inner renderer in a QgsPointClusterRenderer (points only)."""
    cluster = next((t for t in preprocess if t.get("type") == "cluster"), {})
    renderer = QgsPointClusterRenderer()
    if inner_renderer is not None:
        renderer.setEmbeddedRenderer(inner_renderer)
    renderer.setTolerance(cluster.get("radius", 10))
    renderer.setToleranceUnit(Qgis.RenderUnit.Pixels)
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


# Geometry types used by QgsVectorTileBasicRendererStyle (0=point, 1=line, 2=poly).
_VT_GEOM_POINT, _VT_GEOM_LINE, _VT_GEOM_POLYGON = 0, 1, 2
_VT_WHEN_GEOM = {
    "Point": _VT_GEOM_POINT,
    "LineString": _VT_GEOM_LINE,
    "Polygon": _VT_GEOM_POLYGON,
}
# Ungated channel -> (geometry, slot), preserving the historic flat-colour mapping.
_VT_CHANNEL_TARGET = {
    "fill-color": (_VT_GEOM_POLYGON, "fill"),
    "stroke-color": (_VT_GEOM_LINE, "stroke"),
    "circle-fill-color": (_VT_GEOM_POINT, "fill"),
    "circle-stroke-color": (_VT_GEOM_POINT, "stroke"),
}


def _vt_layer_geom(grammar_layer: dict[str, Any]) -> int | None:
    """The geometry a layer's ``when: geometryType`` restricts it to, or None."""
    for predicate in grammar_layer.get("when") or []:
        if predicate.get("type") == "geometryType":
            return _VT_WHEN_GEOM.get(predicate.get("value"))
    return None


def _ramp_classes(field: str, stops: list) -> list[tuple[str, list]] | None:
    """Split a colorRamp into N constant-colour classes over a numeric field.

    N stops -> N intervals: ``< s1``, ``[s1, s2)``, ..., ``>= s(N-1)``, each
    coloured by its stop. Discrete (not a smooth gradient), but renders identically
    in every QGIS version — unlike a data-defined colour expression.
    """
    points: list[tuple[float, list]] = []
    for stop in stops:
        try:
            value = float(stop["stop"])
        except (KeyError, TypeError, ValueError):
            continue
        color = stop.get("color")
        if not isinstance(color, list) or len(color) < 3:
            continue
        points.append((value, color))
    if len(points) < 2:
        return None
    points.sort(key=lambda item: item[0])

    classes = []
    last = len(points) - 1
    for i, (value, color) in enumerate(points):
        if i == 0:
            expr = f'"{field}" < {points[1][0]}'
        elif i == last:
            expr = f'"{field}" >= {value}'
        else:
            expr = f'"{field}" >= {value} AND "{field}" < {points[i + 1][0]}'
        classes.append((expr, color))
    return classes


def _categorical_classes(field: str, stops: list) -> list[tuple[str, list]] | None:
    """One ``"field" = value`` class per categorical stop."""
    classes = []
    for stop in stops:
        if "stop" not in stop or not isinstance(stop.get("color"), list):
            continue
        classes.append((f'"{field}" = {_sql_literal(stop["stop"])}', stop["color"]))
    return classes or None


def _scale_classes(
    scale: dict[str, Any] | None,
    field: str | None,
    logs: dict[str, list[str]],
    layer_id: str,
) -> list[tuple[str | None, list]] | None:
    """Classes ``[(filter | None, rgba)]`` for a colour scale, or None.

    A constant colour is a single class with no filter; colorRamp / categorical
    expand to several filtered classes.
    """
    if not scale:
        return None
    scheme = scale.get("scheme")
    params = scale.get("params", {})
    if scheme == "constant_rgba":
        return [(None, params.get("value"))]
    if scheme == "colorRamp" and field:
        classes = _ramp_classes(field, params.get("colorStops") or [])
        if classes:
            return classes
    elif scheme == "categorical" and field:
        classes = _categorical_classes(field, params.get("colorStops") or [])
        if classes:
            return classes
    _warn(
        logs,
        layer_id,
        f"vector-tile {scheme!r} colour could not be translated; "
        "using a default colour.",
    )
    return None


def _emit_vt_specs(
    geom: int,
    fill_scale: dict[str, Any] | None,
    stroke_scale: dict[str, Any] | None,
    field: str | None,
    logs: dict[str, list[str]],
    layer_id: str,
) -> list[dict[str, Any]]:
    """Style specs for one geometry from its fill/stroke colour scales.

    Fill and stroke that share a ramp produce aligned classes; a constant colour
    repeats across every class of the data-driven one.
    """
    fill_classes = _scale_classes(fill_scale, field, logs, layer_id)
    stroke_classes = _scale_classes(stroke_scale, field, logs, layer_id)
    if not fill_classes and not stroke_classes:
        return []

    driver = None
    for candidate in (fill_classes, stroke_classes):
        if candidate and (driver is None or len(candidate) > len(driver)):
            driver = candidate

    specs = []
    for index, (filter_expr, _) in enumerate(driver):
        fill = None
        if fill_classes:
            aligned = len(fill_classes) == len(driver)
            fill = fill_classes[index][1] if aligned else fill_classes[0][1]
        stroke = None
        if stroke_classes:
            aligned = len(stroke_classes) == len(driver)
            stroke = stroke_classes[index][1] if aligned else stroke_classes[0][1]
        specs.append(
            {"geom": geom, "filter": filter_expr, "fill": fill, "stroke": stroke},
        )
    return specs


def grammar_to_vector_tile_styles(
    symbology_state: dict[str, Any],
    logs: dict[str, list[str]],
    layer_id: str,
) -> list[dict[str, Any]]:
    """Vector-tile style specs from a grammar — constant colours only.

    A data-driven colour (colorRamp / categorical) becomes several styles, one per
    class, each a value filter plus a constant colour, because QGIS data-defined
    symbol colours do NOT round-trip across QGIS versions (3.40 writes them, 3.44
    drops them) while plain constant-colour styles render everywhere. Returns
    ``[{"geom", "filter", "fill", "stroke"}, ...]``.
    """
    specs: list[dict[str, Any]] = []
    for grammar_layer in symbology_state.get("layers") or []:
        gate = _vt_layer_geom(grammar_layer)
        for rule in grammar_layer.get("rules", []):
            field = (rule.get("fields") or [None])[0]
            if gate is not None:
                fill_scale = stroke_scale = None
                for mapping in rule.get("mappings", []):
                    channels = set(mapping.get("channels", []))
                    if channels & _FILL_CHANNELS:
                        fill_scale = mapping.get("scale", {})
                    if channels & _STROKE_COLOR_CHANNELS:
                        stroke_scale = mapping.get("scale", {})
                specs.extend(
                    _emit_vt_specs(
                        gate,
                        fill_scale,
                        stroke_scale,
                        field,
                        logs,
                        layer_id,
                    ),
                )
            else:
                # Ungated: each channel maps to its own geometry/slot.
                for mapping in rule.get("mappings", []):
                    scale = mapping.get("scale", {})
                    for channel in mapping.get("channels", []):
                        target = _VT_CHANNEL_TARGET.get(channel)
                        if not target:
                            continue
                        geom, slot = target
                        fill = scale if slot == "fill" else None
                        stroke = scale if slot == "stroke" else None
                        specs.extend(
                            _emit_vt_specs(geom, fill, stroke, field, logs, layer_id),
                        )
    return specs


# Import: vector-tile geometry (int) -> grammar channel for a colour slot.
_VT_IMPORT_CHANNELS = {
    (_VT_GEOM_POLYGON, "fill"): "fill-color",
    (_VT_GEOM_POLYGON, "stroke"): "stroke-color",
    (_VT_GEOM_LINE, "stroke"): "stroke-color",
    (_VT_GEOM_POINT, "fill"): "circle-fill-color",
    (_VT_GEOM_POINT, "stroke"): "circle-stroke-color",
}
_VT_GEOM_WHEN = {geom: name for name, geom in _VT_WHEN_GEOM.items()}


def _vt_instr_to_scale(instr: tuple) -> tuple[dict | None, str | None]:
    """A grammar scale dict (+ optional field) for an imported colour instruction."""
    kind = instr[0]
    if kind == "const":
        return {"scheme": "constant_rgba", "params": {"value": instr[1]}}, None
    if kind == "colorRamp":
        _, field, stops = instr
        return {
            "scheme": "colorRamp",
            "params": {
                "name": "custom",
                "nShades": len(stops),
                "mode": "equal interval",
                "reverse": False,
                "fallback": list(_TRANSPARENT),
                "colorStops": stops,
            },
        }, field
    if kind == "categorical":
        _, field, stops = instr
        return {
            "scheme": "categorical",
            "params": {
                "colorRamp": "custom",
                "reverse": False,
                "fallback": list(_TRANSPARENT),
                "colorStops": stops,
            },
        }, field
    return None, None


def vector_tile_grammar(
    geom_styles: dict[int, dict[str, tuple]],
) -> dict[str, Any]:
    """Grammar for a vector tile from per-geometry colour instructions.

    Inverse of :func:`grammar_to_vector_tile_styles`: each geometry becomes a
    ``when: geometryType`` gated layer carrying its fill/stroke colour scales.
    """
    layers = []
    for geom, slots in geom_styles.items():
        mappings = []
        field = None
        for slot, instr in slots.items():
            channel = _VT_IMPORT_CHANNELS.get((geom, slot))
            if channel is None:
                continue
            scale, scale_field = _vt_instr_to_scale(instr)
            if scale is None:
                continue
            if scale_field:
                field = scale_field
            mappings.append({"scale": scale, "channels": [channel]})
        if not mappings:
            continue
        rule: dict[str, Any] = {"id": _new_id(), "mappings": mappings}
        if field:
            rule["fields"] = [field]
        layer: dict[str, Any] = {"id": _new_id(), "rules": [rule]}
        when_geom = _VT_GEOM_WHEN.get(geom)
        if when_geom:
            layer["when"] = [{"type": "geometryType", "value": when_geom}]
        layers.append(layer)
    return {"layers": layers}


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
