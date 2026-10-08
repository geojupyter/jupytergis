"""Migration from schema version 0.6.0 to 0.7.0.

Moves ``declutter`` off the grammar layers and onto the jGIS layer:
  - ``parameters.symbologyState.layers[].declutter`` → ``parameters.declutter``
"""

from typing import Any


def migrate(doc: dict[str, Any]) -> dict[str, Any]:
    layers = dict(doc.get("layers", {}))

    for layer_id, layer in layers.items():
        if layer.get("type") not in ("VectorLayer", "VectorTileLayer"):
            continue

        params = layer.get("parameters") or {}
        state = params.get("symbologyState")
        if not isinstance(state, dict):
            continue

        grammar_layers = state.get("layers")
        if not isinstance(grammar_layers, list):
            continue

        declutter = any(
            isinstance(gl, dict) and gl.get("declutter") for gl in grammar_layers
        )
        new_grammar_layers = [
            {k: v for k, v in gl.items() if k != "declutter"}
            if isinstance(gl, dict)
            else gl
            for gl in grammar_layers
        ]

        new_params = {
            **params,
            "symbologyState": {**state, "layers": new_grammar_layers},
        }
        if declutter:
            new_params["declutter"] = True

        layers[layer_id] = {**layer, "parameters": new_params}

    return {**doc, "layers": layers}
