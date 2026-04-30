"""Migration from schema version 0.5.0 to 0.6.0.

Converts the legacy ``parameters.color`` representation (OpenLayers FlatStyle
keys such as ``fill-color``, ``stroke-color``, ``circle-radius``) to the
structured ``parameters.symbologyState`` field introduced in 0.6.0.
"""

from typing import Any


def migrate(doc: dict[str, Any]) -> dict[str, Any]:
    layers = dict(doc.get("layers", {}))

    for layer_id, layer in layers.items():
        layer = dict(layer)

        if layer.get("type") == "WebGlLayer":
            layer["type"] = "GeoTiffLayer"

        params = dict(layer.get("parameters", {}))

        if "color" not in params:
            layers[layer_id] = layer
            continue

        color = params["color"]
        layer_type = layer.get("type", "")

        if layer_type in ("VectorLayer", "VectorTileLayer"):
            if isinstance(color, dict):
                derived = _vector_symbology_from_color(color)
                existing = params.get("symbologyState") or {}
                params["symbologyState"] = {**derived, **existing}
        elif layer_type == "HeatmapLayer":
            state = dict(params.get("symbologyState") or {"renderType": "Heatmap"})
            if isinstance(color, list) and "gradient" not in state:
                state["gradient"] = color
            params["symbologyState"] = state

        del params["color"]
        layer["parameters"] = params
        layers[layer_id] = layer

    return {**doc, "layers": layers}


def _vector_symbology_from_color(color_expr: Any) -> dict[str, Any]:
    state: dict[str, Any] = {"renderType": "Single Symbol"}

    if not isinstance(color_expr, dict):
        return state

    fill = _to_rgba(color_expr.get("fill-color") or color_expr.get("circle-fill-color"))
    if fill is not None:
        state["fillColor"] = fill

    stroke = _to_rgba(
        color_expr.get("stroke-color") or color_expr.get("circle-stroke-color"),
    )
    if stroke is not None:
        state["strokeColor"] = stroke

    stroke_width = color_expr.get("stroke-width") or color_expr.get(
        "circle-stroke-width",
    )
    if isinstance(stroke_width, (int, float)):
        state["strokeWidth"] = float(stroke_width)

    radius = color_expr.get("circle-radius")
    if isinstance(radius, (int, float)):
        state["radius"] = float(radius)

    if "circle-fill-color" in color_expr or "circle-radius" in color_expr:
        state["geometryType"] = "circle"
    elif "fill-color" in color_expr:
        state["geometryType"] = "fill"
    elif "stroke-color" in color_expr or "stroke-width" in color_expr:
        state["geometryType"] = "line"

    return state


def _to_rgba(value: Any) -> list[float] | None:
    if (
        isinstance(value, (list, tuple))
        and value
        and isinstance(value[0], (int, float))
    ):
        rgba = list(value) + [1.0] * (4 - len(value))
        return [float(c) for c in rgba[:4]]
    if isinstance(value, str):
        s = value.lstrip("#")
        if len(s) == 6 and all(c in "0123456789abcdefABCDEF" for c in s):
            return [
                float(int(s[0:2], 16)),
                float(int(s[2:4], 16)),
                float(int(s[4:6], 16)),
                1.0,
            ]
    return None
