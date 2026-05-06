"""Migration from schema version 0.6.0 to 0.7.0.

Converts VectorLayer and VectorTileLayer symbologyState to Grammar format.
Supported render types: Single Symbol, Graduated, Categorized.
Canonical and Grammar layers are left unchanged.
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
        layer_type = layer.get("type", "")
        if layer_type not in ("VectorLayer", "VectorTileLayer"):
            continue

        params = layer.get("parameters") or {}
        state = params.get("symbologyState") or {}
        render_type = state.get("renderType")

        if not render_type or render_type == "Grammar":
            continue

        grammar_state = _to_grammar(state)
        if grammar_state is None:
            continue

        layers[layer_id] = {
            **layer,
            "parameters": {**params, "symbologyState": grammar_state},
        }

    return {**doc, "layers": layers}


def _to_grammar(state: dict[str, Any]) -> dict[str, Any] | None:
    render_type = state.get("renderType")
    if render_type == "Single Symbol":
        return _single_symbol(state)
    if render_type == "Graduated":
        return _graduated(state)
    if render_type == "Categorized":
        return _categorized(state)
    return None


def _single_symbol(state: dict[str, Any]) -> dict[str, Any]:
    fill = state.get("fillColor") or _DEFAULT_FILL
    stroke = state.get("strokeColor") or _DEFAULT_STROKE
    stroke_width = state.get("strokeWidth") or _DEFAULT_STROKE_WIDTH
    radius = state.get("radius") or _DEFAULT_RADIUS

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
    return {"renderType": "Grammar", "layers": [{"id": str(uuid.uuid4()), "rules": [rule]}]}


def _graduated(state: dict[str, Any]) -> dict[str, Any]:
    field = state.get("value")
    fallback = state.get("fallbackColor") or _TRANSPARENT
    stroke = state.get("strokeColor") or _DEFAULT_STROKE
    stroke_width = state.get("strokeWidth") or _DEFAULT_STROKE_WIDTH
    radius = state.get("radius") or _DEFAULT_RADIUS

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
        mappings.append({
            "scale": {"scheme": "constant_rgba", "params": {"value": stroke}},
            "channels": ["stroke-color", "circle-stroke-color"],
        })
    mappings += [
        {"scale": {"scheme": "constant_num", "params": {"value": stroke_width}}, "channels": ["stroke-width", "circle-stroke-width"]},
        {"scale": {"scheme": "constant_num", "params": {"value": radius}}, "channels": ["circle-radius"]},
    ]

    rule: dict[str, Any] = {"id": str(uuid.uuid4()), "mappings": mappings}
    if field:
        rule["fields"] = [field]

    return {"renderType": "Grammar", "layers": [{"id": str(uuid.uuid4()), "rules": [rule]}]}


def _categorized(state: dict[str, Any]) -> dict[str, Any]:
    field = state.get("value")
    fallback = state.get("fallbackColor") or _TRANSPARENT
    stroke = state.get("strokeColor") or _DEFAULT_STROKE
    stroke_width = state.get("strokeWidth") or _DEFAULT_STROKE_WIDTH
    radius = state.get("radius") or _DEFAULT_RADIUS

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
        mappings.append({
            "scale": {"scheme": "constant_rgba", "params": {"value": stroke}},
            "channels": ["stroke-color", "circle-stroke-color"],
        })
    mappings += [
        {"scale": {"scheme": "constant_num", "params": {"value": stroke_width}}, "channels": ["stroke-width", "circle-stroke-width"]},
        {"scale": {"scheme": "constant_num", "params": {"value": radius}}, "channels": ["circle-radius"]},
    ]

    rule: dict[str, Any] = {"id": str(uuid.uuid4()), "mappings": mappings}
    if field:
        rule["fields"] = [field]

    return {"renderType": "Grammar", "layers": [{"id": str(uuid.uuid4()), "rules": [rule]}]}
