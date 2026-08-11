from __future__ import annotations

import os
import re
from typing import Final


FEATURE_STORE_TABLE_PREFIX: Final[str] = "jgis_store_"

# PostgreSQL identifiers are capped at 63 bytes.
FEATURE_STORE_SLUG_MAX_LENGTH: Final[int] = (
    63 - len(FEATURE_STORE_TABLE_PREFIX)
)

_UUID_HEX_RE: Final[re.Pattern[str]] = re.compile(r"^[0-9a-f]{32}$")
_SLUG_RE: Final[re.Pattern[str]] = re.compile(r"^[a-z][a-z0-9_]*$")


def get_postgis_url() -> str | None:
    """Return the shared PostGIS connection URL from env (if set)."""

    url = os.environ.get("JGIS_POSTGIS_URL")
    if url is None:
        return None
    url = url.strip()
    return url or None


def normalize_store_id_slug(store_id: str) -> str:
    """
    Normalize a collaborative store id to a safe lowercase slug.

    Rules (mirrors the TS implementation):
    - UUID (with or without dashes) -> 32 hex chars
    - Otherwise: lowercase, non [a-z0-9_] -> '_', collapse '_' runs,
      strip leading/trailing underscores.
    - Result must start with a letter and fit length limits.
    """

    trimmed = store_id.strip().lower()
    if not trimmed:
        raise ValueError("storeId is required")

    uuid_hex = trimmed.replace("-", "")
    if _UUID_HEX_RE.match(uuid_hex):
        return uuid_hex

    slug = re.sub(r"[^a-z0-9_]+", "_", trimmed)
    slug = re.sub(r"_+", "_", slug)
    slug = slug.strip("_")

    if not slug or not _SLUG_RE.match(slug):
        raise ValueError(
            f'storeId "{store_id}" cannot be converted to a safe table slug '
            '(use a UUID or an identifier starting with a letter)'
        )

    if len(slug) > FEATURE_STORE_SLUG_MAX_LENGTH:
        raise ValueError(
            "storeId slug exceeds "
            f"{FEATURE_STORE_SLUG_MAX_LENGTH} characters after sanitization "
            f"(got {len(slug)})"
        )

    return slug


def store_id_to_table_name(store_id: str) -> str:
    """Map storeId to PostGIS table name (`jgis_store_<slug>`)."""

    return f"{FEATURE_STORE_TABLE_PREFIX}{normalize_store_id_slug(store_id)}"


def feature_store_table_ddl(table_name: str) -> str:
    """
    Return DDL to create a per-store baseline table and its spatial index.

    Notes:
    - `table_name` must already be validated via store_id_to_table_name.
    - geometry SRID is fixed to 4326 (lon/lat degrees).
    """

    if not re.match(r"^jgis_store_[a-z0-9_]+$", table_name):
        raise ValueError(f"Refusing DDL for unexpected table name: {table_name}")

    index_name = f"{table_name}_geom_gix"
    # Use a fixed Point SRID because collaborative points are lon/lat degrees.
    return "\n".join(
        [
            f"CREATE TABLE IF NOT EXISTS {table_name} (",
            "  id uuid PRIMARY KEY,",
            "  geom geometry(Point, 4326) NOT NULL,",
            "  props jsonb NOT NULL DEFAULT '{}'::jsonb,",
            "  updated_at timestamptz NOT NULL DEFAULT now(),",
            "  updated_by text",
            ");",
            f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} "
            "USING GIST (geom);",
        ]
    )

