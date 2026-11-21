"""Migration from schema version 0.7.0 to 0.7.1.

Drops ``useProxy`` from the sources: whether a request goes through the CORS
proxy is now worked out per domain at runtime.
"""

from typing import Any


def migrate(doc: dict[str, Any]) -> dict[str, Any]:
    sources = dict(doc.get("sources", {}))

    for source_id, source in sources.items():
        params = source.get("parameters") if isinstance(source, dict) else None
        if not isinstance(params, dict) or "useProxy" not in params:
            continue

        sources[source_id] = {
            **source,
            "parameters": {k: v for k, v in params.items() if k != "useProxy"},
        }

    return {**doc, "sources": sources}
