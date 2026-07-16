from __future__ import annotations

import math
import re
import uuid
from typing import Any

from jupytergis_core.color_ramps import sample_colors
from jupytergis_core.colors import hex_to_rgba, rgb_to_hex
from PyQt5.QtGui import QColor
from qgis.core import (  # type: ignore[import-untyped]
    Qgis,
    QgsColorRampShader,
    QgsContrastEnhancement,
    QgsExpression,
    QgsExpressionNodeBinaryOperator,
    QgsExpressionNodeColumnRef,
    QgsExpressionNodeFunction,
    QgsExpressionNodeLiteral,
    QgsFillSymbol,
    QgsGradientColorRamp,
    QgsGradientStop,
    QgsHeatmapRenderer,
    QgsLineSymbol,
    QgsMarkerSymbol,
    QgsMultiBandColorRenderer,
    QgsPointClusterRenderer,
    QgsRasterBandStats,
    QgsRasterShader,
    QgsSingleBandPseudoColorRenderer,
    QgsVectorTileBasicRendererStyle,
)
from qgis.PyQt import sip
from qgis.PyQt.QtCore import Qt

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

# Encoding groups (see packages/schema/src/_interface/project/symbology.d.ts).
_FILL_ENCODINGS = {"fill-color", "circle-fill-color"}
_STROKE_COLOR_ENCODINGS = {"stroke-color", "circle-stroke-color"}
_STROKE_WIDTH_ENCODINGS = {"stroke-width", "circle-stroke-width"}
_RADIUS_ENCODINGS = {"circle-radius"}
_PIXEL_COLOR_ENCODINGS = {"pixel-color", "pixel-rgb"}
_PIXEL_ALPHA_ENCODINGS = {"pixel-alpha"}
# Multiband RGB sub-encoding -> color index (red=0, green=1, blue=2).
_PIXEL_BAND_ENCODINGS = {"pixel-red": 0, "pixel-green": 1, "pixel-blue": 2}


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
                "encodings": ["pixel-color"],
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
    index_to_encoding = {0: "pixel-red", 1: "pixel-green", 2: "pixel-blue"}
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
                    {"scale": scale, "encodings": [index_to_encoding[index]]},
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
                        "encodings": ["pixel-alpha"],
                    },
                ],
            },
        )
    return {"layers": [{"id": _new_id(), "rules": rules}]}


def kde_grammar(
    radius: float,
    weight_field: str | None,
    color_stops: list | None,
    ramp_name: str | None = None,
    reverse: bool = False,
) -> dict[str, Any]:
    """Grammar for a KDE heatmap layer read back from a QgsHeatmapRenderer.

    ``ramp_name`` is the stashed colour-ramp name (the heatmap gradient bakes
    colours and loses it); falls back to ``"custom"`` for layers exported before the
    name was persisted.
    """
    params: dict[str, Any] = {
        "name": ramp_name or "custom",
        "nShades": len(color_stops) if color_stops else 9,
        "mode": "equal interval",
        "reverse": reverse,
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
                "encodings": ["pixel-rgb"],
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
                "circle-radius" in mapping.get("encodings", [])
                and mapping.get("scale", {}).get("scheme") == "scalar"
            ):
                return "circle"
    return None


def grammar_layer_alpha_factor(grammar_layer: dict[str, Any]) -> float:
    """Constant pixel-alpha/fill-alpha for a grammar layer, applied as layer opacity."""
    for rule in grammar_layer.get("rules", []):
        for mapping in rule.get("mappings", []):
            encodings = set(mapping.get("encodings", []))
            if encodings & {"pixel-alpha", "fill-alpha"}:
                scale = mapping.get("scale", {})
                if scale.get("scheme") == "constant_num":
                    return scale.get("params", {}).get("value", 1.0)
    return 1.0


def _heatmap_color_ramp(grammar_layer):
    """A QGIS heatmap gradient from the layer's colorRamp scale, or None.

    Only the first stop (density 0) is transparent; every other stop is fully
    opaque. A QGIS heatmap maps density 0 -> the ramp's first colour, so an opaque
    first colour would paint the whole extent (the heatmap "covering the map") --
    keeping just that one stop transparent avoids it while matching the source
    ramp, which is opaque (the earlier gradual alpha ramp wrongly left the first
    few stops semi-transparent). The hues come from the named ramp (e.g. viridis).
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

            def _stop_color(i: int, colors: list = colors) -> QColor:
                r, g, b = colors[i][0], colors[i][1], colors[i][2]
                alpha = 0 if i == 0 else 255
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
    """Extract constant per-encoding colors from grammar (for vector tile export)."""
    colors: dict[str, list] = {}
    for grammar_layer in symbology_state.get("layers") or []:
        for rule in grammar_layer.get("rules", []):
            for mapping in rule.get("mappings", []):
                scale = mapping.get("scale", {})
                if scale.get("scheme") != "constant_rgba":
                    continue
                value = scale.get("params", {}).get("value")
                for encoding in mapping.get("encodings", []):
                    colors.setdefault(encoding, value)
    return colors


# Geometry types used by QgsVectorTileBasicRendererStyle (0=point, 1=line, 2=poly).
_VT_GEOM_POINT, _VT_GEOM_LINE, _VT_GEOM_POLYGON = 0, 1, 2
_VT_WHEN_GEOM = {
    "Point": _VT_GEOM_POINT,
    "LineString": _VT_GEOM_LINE,
    "Polygon": _VT_GEOM_POLYGON,
}
# Ungated encoding -> (geometry, slot), preserving the historic flat-colour mapping.
_VT_ENCODING_TARGET = {
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


def _vt_layer_widths(
    grammar_layer: dict[str, Any],
    gate: int | None,
) -> dict[int, float]:
    """Constant stroke widths a layer applies, keyed by geometry.

    ``stroke-width`` drives line and polygon-outline width; ``circle-stroke-width``
    drives point-outline width. A gated layer routes both to its one geometry.
    """
    widths: dict[int, float] = {}
    for rule in grammar_layer.get("rules", []):
        for mapping in rule.get("mappings", []):
            scale = mapping.get("scale", {})
            if scale.get("scheme") != "constant_num":
                continue
            value = scale.get("params", {}).get("value")
            if value is None:
                continue
            encodings = set(mapping.get("encodings", []))
            if "stroke-width" in encodings:
                geoms = (
                    (gate,) if gate is not None else (_VT_GEOM_LINE, _VT_GEOM_POLYGON)
                )
                for geom in geoms:
                    widths.setdefault(geom, float(value))
            if "circle-stroke-width" in encodings:
                geoms = (gate,) if gate is not None else (_VT_GEOM_POINT,)
                for geom in geoms:
                    widths.setdefault(geom, float(value))
    return widths


def _ramp_classes(field: str, stops: list) -> list[tuple[str, list]] | None:
    """Split a colorRamp into N constant-colour classes over a numeric field.

    N stops -> N intervals: ``[s0, s1)``, ``[s1, s2)``, ..., ``>= s(N-1)``, each
    coloured by its stop. Discrete (not a smooth gradient), but renders identically
    in every QGIS version — unlike a data-defined colour expression.

    The first class keeps its lower bound ``>= s0`` (s0 is the ramp's first stop,
    i.e. the domain minimum, so no in-range feature is excluded) so the first stop
    survives the round trip; an open ``< s1`` would lose s0 and let the reimport
    collapse the first two classes into one.
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
        if i == last:
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
    drops them) while plain constant-colour styles render everywhere. A constant
    stroke width rides on every class of its geometry. Returns
    ``[{"geom", "filter", "fill", "stroke"[, "width"]}, ...]``.
    """
    specs: list[dict[str, Any]] = []
    for grammar_layer in symbology_state.get("layers") or []:
        gate = _vt_layer_geom(grammar_layer)
        layer_specs: list[dict[str, Any]] = []
        for rule in grammar_layer.get("rules", []):
            field = (rule.get("fields") or [None])[0]
            if gate is not None:
                fill_scale = stroke_scale = None
                for mapping in rule.get("mappings", []):
                    encodings = set(mapping.get("encodings", []))
                    if encodings & _FILL_ENCODINGS:
                        fill_scale = mapping.get("scale", {})
                    if encodings & _STROKE_COLOR_ENCODINGS:
                        stroke_scale = mapping.get("scale", {})
                layer_specs.extend(
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
                # Ungated: each encoding maps to its own geometry/slot.
                for mapping in rule.get("mappings", []):
                    scale = mapping.get("scale", {})
                    for encoding in mapping.get("encodings", []):
                        target = _VT_ENCODING_TARGET.get(encoding)
                        if not target:
                            continue
                        geom, slot = target
                        fill = scale if slot == "fill" else None
                        stroke = scale if slot == "stroke" else None
                        layer_specs.extend(
                            _emit_vt_specs(geom, fill, stroke, field, logs, layer_id),
                        )

        widths = _vt_layer_widths(grammar_layer, gate)
        for spec in layer_specs:
            width = widths.get(spec["geom"])
            if width is not None:
                spec["width"] = width
        specs.extend(layer_specs)
    return specs


# Import: vector-tile geometry (int) -> grammar encoding for a colour slot.
_VT_IMPORT_ENCODINGS = {
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


def _vt_width_mapping(geom: int, width: float) -> dict[str, Any]:
    """A constant stroke-width mapping for a geometry's import."""
    encoding = "circle-stroke-width" if geom == _VT_GEOM_POINT else "stroke-width"
    return {
        "scale": {"scheme": "constant_num", "params": {"value": width}},
        "encodings": [encoding],
    }


def vector_tile_grammar(
    geom_styles: dict[int, dict[str, tuple]],
    geom_widths: dict[int, float] | None = None,
) -> dict[str, Any]:
    """Grammar for a vector tile from per-geometry colour instructions.

    Inverse of :func:`grammar_to_vector_tile_styles`: each geometry becomes a
    ``when: geometryType`` gated layer carrying its fill/stroke colour scales and
    any constant stroke width.

    When every geometry reconstructs to the *same* data-driven colour (QGIS export
    splits one ungated colorRamp/categorical into a style set per geometry), the
    geometries are folded back into a single ungated layer rather than emitting one
    identical rule per geometry.
    """
    geom_widths = geom_widths or {}

    colour_instrs = [
        (geom, slot, instr)
        for geom, slots in geom_styles.items()
        for slot, instr in slots.items()
    ]
    data_driven = [t for t in colour_instrs if t[2][0] in ("colorRamp", "categorical")]
    if (
        len(data_driven) > 1
        and len(data_driven) == len(colour_instrs)
        and all(instr == data_driven[0][2] for _, _, instr in data_driven)
    ):
        scale, field = _vt_instr_to_scale(data_driven[0][2])
        encodings = []
        for geom, slot, _ in data_driven:
            encoding = _VT_IMPORT_ENCODINGS.get((geom, slot))
            if encoding and encoding not in encodings:
                encodings.append(encoding)
        mappings: list[dict[str, Any]] = [{"scale": scale, "encodings": encodings}]
        for geom, width in geom_widths.items():
            mapping = _vt_width_mapping(geom, width)
            if mapping not in mappings:
                mappings.append(mapping)
        rule: dict[str, Any] = {"id": _new_id(), "mappings": mappings}
        if field:
            rule["fields"] = [field]
        return {"layers": [{"id": _new_id(), "rules": [rule]}]}

    layers = []
    for geom, slots in geom_styles.items():
        mappings = []
        field = None
        for slot, instr in slots.items():
            encoding = _VT_IMPORT_ENCODINGS.get((geom, slot))
            if encoding is None:
                continue
            scale, scale_field = _vt_instr_to_scale(instr)
            if scale is None:
                continue
            if scale_field:
                field = scale_field
            mappings.append({"scale": scale, "encodings": [encoding]})
        if geom in geom_widths:
            mappings.append(_vt_width_mapping(geom, geom_widths[geom]))
        if not mappings:
            continue
        rule = {"id": _new_id(), "mappings": mappings}
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
                encodings = set(mapping.get("encodings", []))
                scale = mapping.get("scale", {})
                if (
                    encodings & _PIXEL_COLOR_ENCODINGS
                    and scale.get("scheme") == "colorRamp"
                ):
                    color_params = scale.get("params", {})
                    if rule_band is not None:
                        band = rule_band
                elif encodings & _PIXEL_ALPHA_ENCODINGS:
                    alpha_present = True
                    if rule_band is not None:
                        alpha_band = rule_band
                else:
                    for encoding in encodings & _PIXEL_BAND_ENCODINGS.keys():
                        if rule_band is not None:
                            multiband[_PIXEL_BAND_ENCODINGS[encoding]] = (
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


# ---------------------------------------------------------------------------
# QGIS symbol / expression -> Grammar parsing helpers.
# Shared by both qgis_loader and data_defined on import; they live here (the
# lower shared module) so neither importer has to depend on the other.
# ---------------------------------------------------------------------------


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
