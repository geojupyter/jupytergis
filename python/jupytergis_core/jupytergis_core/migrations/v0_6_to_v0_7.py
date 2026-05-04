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

    return {
        "renderType": "Grammar",
        "rules": [
            {
                "id": str(uuid.uuid4()),
                "mappings": [
                    {
                        "outputType": "rgba",
                        "scale": {"scheme": "constant", "value": fill},
                        "channels": ["fill-color", "circle-fill-color"],
                    },
                    {
                        "outputType": "rgba",
                        "scale": {"scheme": "constant", "value": stroke},
                        "channels": ["stroke-color", "circle-stroke-color"],
                    },
                    {
                        "outputType": "posfloat",
                        "scale": {"scheme": "constant", "value": stroke_width},
                        "channels": ["stroke-width", "circle-stroke-width"],
                    },
                    {
                        "outputType": "posfloat",
                        "scale": {"scheme": "constant", "value": radius},
                        "channels": ["circle-radius"],
                    },
                ],
            }
        ],
    }


def _graduated(state: dict[str, Any]) -> dict[str, Any]:
    field = state.get("value")
    fallback = state.get("fallbackColor") or _TRANSPARENT
    stroke = state.get("strokeColor") or _DEFAULT_STROKE
    stroke_width = state.get("strokeWidth") or _DEFAULT_STROKE_WIDTH
    radius = state.get("radius") or _DEFAULT_RADIUS

    color_ramp_scale: dict[str, Any] = {
        "scheme": "colorRamp",
        "name": state.get("colorRamp") or "viridis",
        "nShades": state.get("nClasses") or 9,
        "mode": state.get("mode") or "equal interval",
        "reverse": state.get("reverseRamp") or False,
        "fallback": fallback,
    }
    vmin = state.get("vmin")
    vmax = state.get("vmax")
    if vmin is not None and vmax is not None:
        color_ramp_scale["domain"] = [vmin, vmax]

    if state.get("strokeFollowsFill"):
        stroke_mapping = {
            "outputType": "rgba",
            "scale": color_ramp_scale,
            "channels": ["stroke-color", "circle-stroke-color"],
        }
    else:
        stroke_mapping = {
            "outputType": "rgba",
            "scale": {"scheme": "constant", "value": stroke},
            "channels": ["stroke-color", "circle-stroke-color"],
        }

    rule: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "mappings": [
            {
                "outputType": "rgba",
                "scale": color_ramp_scale,
                "channels": ["fill-color", "circle-fill-color"],
            },
            stroke_mapping,
            {
                "outputType": "posfloat",
                "scale": {"scheme": "constant", "value": stroke_width},
                "channels": ["stroke-width", "circle-stroke-width"],
            },
            {
                "outputType": "posfloat",
                "scale": {"scheme": "constant", "value": radius},
                "channels": ["circle-radius"],
            },
        ],
    }
    if field:
        rule["field"] = field

    return {"renderType": "Grammar", "rules": [rule]}


def _categorized(state: dict[str, Any]) -> dict[str, Any]:
    field = state.get("value")
    fallback = state.get("fallbackColor") or _TRANSPARENT
    stroke = state.get("strokeColor") or _DEFAULT_STROKE
    stroke_width = state.get("strokeWidth") or _DEFAULT_STROKE_WIDTH
    radius = state.get("radius") or _DEFAULT_RADIUS

    categorical_scale: dict[str, Any] = {
        "scheme": "categorical",
        "colorRamp": state.get("colorRamp") or "viridis",
        "reverse": state.get("reverseRamp") or False,
        "fallback": fallback,
    }
    n_classes = state.get("nClasses")
    if n_classes is not None:
        categorical_scale["nShades"] = n_classes

    if state.get("strokeFollowsFill"):
        stroke_mapping = {
            "outputType": "rgba",
            "scale": categorical_scale,
            "channels": ["stroke-color", "circle-stroke-color"],
        }
    else:
        stroke_mapping = {
            "outputType": "rgba",
            "scale": {"scheme": "constant", "value": stroke},
            "channels": ["stroke-color", "circle-stroke-color"],
        }

    rule: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "mappings": [
            {
                "outputType": "rgba",
                "scale": categorical_scale,
                "channels": ["fill-color", "circle-fill-color"],
            },
            stroke_mapping,
            {
                "outputType": "posfloat",
                "scale": {"scheme": "constant", "value": stroke_width},
                "channels": ["stroke-width", "circle-stroke-width"],
            },
            {
                "outputType": "posfloat",
                "scale": {"scheme": "constant", "value": radius},
                "channels": ["circle-radius"],
            },
        ],
    }
    if field:
        rule["field"] = field

    return {"renderType": "Grammar", "rules": [rule]}
