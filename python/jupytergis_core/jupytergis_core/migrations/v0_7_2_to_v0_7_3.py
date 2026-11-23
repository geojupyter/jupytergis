"""Migration from schema version 0.7.2 to 0.7.3.

OpenLayers saved ``options.bearing`` as its view rotation in radians. It is
now the compass bearing in degrees, as MapLibre and story segments save it.
"""

import math
from typing import Any


def migrate(doc: dict[str, Any]) -> dict[str, Any]:
    options = doc.get("options") or {}
    if not options.get("bearing") or options.get("mapAdapter") == "maplibre":
        return doc

    return {
        **doc,
        "options": {**options, "bearing": -math.degrees(options["bearing"])},
    }
