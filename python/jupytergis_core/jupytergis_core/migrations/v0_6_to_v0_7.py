"""Migration from schema version 0.6.0 to 0.7.0.

Moves flat metadata keys ``annotation_<id>`` into
``metadata.annotations.<id>``.
"""

import json
import re
from typing import Any

_ANNOTATION_KEY_PATTERN = re.compile(r"^annotation_(.+)$")


def migrate(doc: dict[str, Any]) -> dict[str, Any]:
    metadata = dict(doc.get("metadata") or {})
    existing = metadata.get("annotations")
    annotations: dict[str, Any] = (
        dict(existing)
        if isinstance(existing, dict) and not isinstance(existing, list)
        else {}
    )

    for key, value in metadata.items():
        match = _ANNOTATION_KEY_PATTERN.match(key)
        if not match:
            continue

        annotation: Any = value
        if isinstance(annotation, str):
            try:
                annotation = json.loads(annotation)
            except json.JSONDecodeError:
                continue

        annotations[match.group(1)] = annotation

    return {
        **doc,
        "metadata": {
            "annotations": annotations,
        },
    }
