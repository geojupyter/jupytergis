"""Migration from schema version 0.5.0 to 0.6.0.

Converts legacy representations to Grammar symbologyState in one pass:
  - parameters.color (flat OL FlatStyle keys) → Grammar directly
  - parameters.symbologyState with old render types → Grammar
  - HeatmapLayer color array → symbologyState.gradient
  - WebGlLayer type → GeoTiffLayer
"""

import uuid
from typing import Any

_DEFAULT_STROKE_WIDTH = 1.25
_DEFAULT_FILL = [255, 255, 255, 0.4]
_DEFAULT_STROKE = [51, 153, 204, 1]
_DEFAULT_RADIUS = 5
_TRANSPARENT = [0, 0, 0, 0]


def migrate(doc: dict[str, Any]) -> dict[str, Any]:
    layers = dict(doc.get("layers", {}))

    for layer_id, layer in layers.items():
        layer = dict(layer)

        if layer.get("type") == "WebGlLayer":
            layer["type"] = "GeoTiffLayer"

        params = dict(layer.get("parameters", {}))
        layer_type = layer.get("type", "")

        if layer_type in ("VectorLayer", "VectorTileLayer"):
            color = params.get("color")
            if isinstance(color, dict):
                # Flat OL color dict → Grammar (skip intermediate symbologyState)
                params["symbologyState"] = _color_to_grammar(color)
                del params["color"]
            else:
                # Handle files that already carry old-style symbologyState (defensive)
                state = params.get("symbologyState") or {}
                render_type = state.get("renderType")
                if render_type and render_type != "Grammar":
                    grammar = _to_grammar(state)
                    if grammar is not None:
                        params["symbologyState"] = grammar

        elif layer_type == "HeatmapLayer":
            color = params.get("color")
            if isinstance(color, list):
                state = dict(params.get("symbologyState") or {"renderType": "Heatmap"})
                if "gradient" not in state:
                    state["gradient"] = color
                params["symbologyState"] = state
                del params["color"]

        layer["parameters"] = params
        layers[layer_id] = layer

    return {**doc, "layers": layers}


def _color_to_grammar(color: dict[str, Any]) -> dict[str, Any]:
    """Convert a flat OL color dict directly to Grammar (Single Symbol)."""
    fill = _to_rgba(color.get("fill-color") or color.get("circle-fill-color"))
    stroke = _to_rgba(
        color.get("stroke-color") or color.get("circle-stroke-color"),
    )
    stroke_width = color.get("stroke-width") or color.get("circle-stroke-width")
    radius = color.get("circle-radius")

    return _single_symbol(
        fill=fill or _DEFAULT_FILL,
        stroke=stroke or _DEFAULT_STROKE,
        stroke_width=float(stroke_width)
        if isinstance(stroke_width, (int, float))
        else _DEFAULT_STROKE_WIDTH,
        radius=float(radius) if isinstance(radius, (int, float)) else _DEFAULT_RADIUS,
    )


def _to_grammar(state: dict[str, Any]) -> dict[str, Any] | None:
    render_type = state.get("renderType")
    if render_type == "Single Symbol":
        return _single_symbol(
            fill=state.get("fillColor") or _DEFAULT_FILL,
            stroke=state.get("strokeColor") or _DEFAULT_STROKE,
            stroke_width=state.get("strokeWidth")
            if state.get("strokeWidth") is not None
            else _DEFAULT_STROKE_WIDTH,
            radius=state.get("radius")
            if state.get("radius") is not None
            else _DEFAULT_RADIUS,
        )
    if render_type == "Graduated":
        return _graduated(state)
    if render_type == "Categorized":
        return _categorized(state)
    return None


def _single_symbol(
    fill: list,
    stroke: list,
    stroke_width: float,
    radius: float,
) -> dict[str, Any]:
    rule = {
        "id": str(uuid.uuid4()),
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
    return {
        "renderType": "Grammar",
        "layers": [{"id": str(uuid.uuid4()), "rules": [rule]}],
    }


def _graduated(state: dict[str, Any]) -> dict[str, Any]:
    field = state.get("value")
    fallback = state.get("fallbackColor") or _TRANSPARENT
    stroke = state.get("strokeColor") or _DEFAULT_STROKE
    stroke_width = (
        state.get("strokeWidth")
        if state.get("strokeWidth") is not None
        else _DEFAULT_STROKE_WIDTH
    )
    radius = state.get("radius") if state.get("radius") is not None else _DEFAULT_RADIUS

    color_ramp_params: dict[str, Any] = {
        "name": state.get("colorRamp") or "viridis",
        "nShades": state.get("nClasses") or 9,
        "mode": state.get("mode") or "equal interval",
        "reverse": state.get("reverseRamp") or False,
        "fallback": fallback,
    }
    vmin = state.get("vmin")
    vmax = state.get("vmax")
    if vmin is not None and vmax is not None:
        color_ramp_params["domain"] = [vmin, vmax]

    color_ramp_scale = {"scheme": "colorRamp", "params": color_ramp_params}

    fill_channels = (
        ["fill-color", "stroke-color", "circle-fill-color", "circle-stroke-color"]
        if state.get("strokeFollowsFill")
        else ["fill-color", "circle-fill-color"]
    )

    mappings: list[dict[str, Any]] = [
        {"scale": color_ramp_scale, "channels": fill_channels},
    ]
    if not state.get("strokeFollowsFill"):
        mappings.append(
            {
                "scale": {"scheme": "constant_rgba", "params": {"value": stroke}},
                "channels": ["stroke-color", "circle-stroke-color"],
            },
        )
    mappings += [
        {
            "scale": {"scheme": "constant_num", "params": {"value": stroke_width}},
            "channels": ["stroke-width", "circle-stroke-width"],
        },
        {
            "scale": {"scheme": "constant_num", "params": {"value": radius}},
            "channels": ["circle-radius"],
        },
    ]

    rule: dict[str, Any] = {"id": str(uuid.uuid4()), "mappings": mappings}
    if field:
        rule["fields"] = [field]

    return {
        "renderType": "Grammar",
        "layers": [{"id": str(uuid.uuid4()), "rules": [rule]}],
    }


def _categorized(state: dict[str, Any]) -> dict[str, Any]:
    field = state.get("value")
    fallback = state.get("fallbackColor") or _TRANSPARENT
    stroke = state.get("strokeColor") or _DEFAULT_STROKE
    stroke_width = (
        state.get("strokeWidth")
        if state.get("strokeWidth") is not None
        else _DEFAULT_STROKE_WIDTH
    )
    radius = state.get("radius") if state.get("radius") is not None else _DEFAULT_RADIUS

    categorical_params: dict[str, Any] = {
        "colorRamp": state.get("colorRamp") or "viridis",
        "reverse": state.get("reverseRamp") or False,
        "fallback": fallback,
    }
    n_classes = state.get("nClasses")
    if n_classes is not None:
        categorical_params["nShades"] = n_classes

    categorical_scale = {"scheme": "categorical", "params": categorical_params}

    fill_channels = (
        ["fill-color", "stroke-color", "circle-fill-color", "circle-stroke-color"]
        if state.get("strokeFollowsFill")
        else ["fill-color", "circle-fill-color"]
    )

    mappings: list[dict[str, Any]] = [
        {"scale": categorical_scale, "channels": fill_channels},
    ]
    if not state.get("strokeFollowsFill"):
        mappings.append(
            {
                "scale": {"scheme": "constant_rgba", "params": {"value": stroke}},
                "channels": ["stroke-color", "circle-stroke-color"],
            },
        )
    mappings += [
        {
            "scale": {"scheme": "constant_num", "params": {"value": stroke_width}},
            "channels": ["stroke-width", "circle-stroke-width"],
        },
        {
            "scale": {"scheme": "constant_num", "params": {"value": radius}},
            "channels": ["circle-radius"],
        },
    ]

    rule: dict[str, Any] = {"id": str(uuid.uuid4()), "mappings": mappings}
    if field:
        rule["fields"] = [field]

    return {
        "renderType": "Grammar",
        "layers": [{"id": str(uuid.uuid4()), "rules": [rule]}],
    }


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
