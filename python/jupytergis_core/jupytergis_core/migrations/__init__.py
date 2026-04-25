"""JupyterGIS document migration runner.

Each entry in STEPS is a tuple ``(from_version, to_version, migrate_fn)``
where ``migrate_fn`` takes the parsed document dict and returns a new dict.
Steps must be listed in order and form a contiguous chain.
"""

from typing import Any

from packaging.version import Version

from . import v0_5_to_v0_6

STEPS = [
    ("0.5.0", "0.6.0", v0_5_to_v0_6.migrate),
]


def migrate(doc: dict[str, Any], to_version: str | None = None) -> dict[str, Any]:
    """Apply all necessary migration steps to bring *doc* up to *to_version*.

    :param doc: Parsed jGIS document dict.
    :param to_version: Target schema version. Defaults to the current
        ``SCHEMA_VERSION`` if omitted.
    :raises ValueError: If the document's version is newer than the current
        schema version.
    """
    from jupytergis_core.schema import SCHEMA_VERSION

    current = Version(doc.get("schemaVersion", "0.5.0"))
    target = Version(to_version or SCHEMA_VERSION)

    if current > Version(SCHEMA_VERSION):
        raise ValueError(
            f"Cannot load file with schema version {current} "
            f"(current: {SCHEMA_VERSION})",
        )

    result = dict(doc)
    for _from_v, to_v, fn in STEPS:
        if current < Version(to_v) and Version(to_v) <= target:
            result = fn(result)
            result["schemaVersion"] = to_v
            current = Version(to_v)

    return result
