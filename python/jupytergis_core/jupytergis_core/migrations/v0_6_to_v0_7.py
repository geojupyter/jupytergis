"""Migration from schema version 0.6.0 to 0.7.0.

Renames StorySegmentLayer content.title → imageCaption.
"""

from typing import Any


def migrate(doc: dict[str, Any]) -> dict[str, Any]:
    layers = dict(doc.get("layers", {}))

    for layer_id, layer in layers.items():
        if layer.get("type") != "StorySegmentLayer":
            continue

        parameters = layer.get("parameters") or {}
        content = parameters.get("content")

        if (
            not isinstance(content, dict)
            or "title" not in content
            or content.get("imageCaption") is not None
        ):
            continue

        rest = {k: v for k, v in content.items() if k != "title"}
        layers[layer_id] = {
            **layer,
            "parameters": {
                **parameters,
                "content": {
                    **rest,
                    "imageCaption": content.get("title") or "",
                },
            },
        }

    return {**doc, "layers": layers}
