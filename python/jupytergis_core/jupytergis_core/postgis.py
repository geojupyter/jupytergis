from __future__ import annotations

import json
import os
import re
import subprocess
import uuid
from typing import Any, Final


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


def _dollar_quote(tag: str, value: str) -> str:
    """Wrap `value` as a PostgreSQL dollar-quoted string."""

    # Tag must not appear in the value; we ensure uniqueness by generating it.
    return f"${tag}${value}${tag}$"


def merge_overlay_features_sql(
    table_name: str,
    features: list[dict[str, Any]],
) -> str:
    """
    Generate SQL to merge overlay features into `table_name` (overlay-wins).

    `features` elements must include:
      - id: str (UUID)
      - lon: float
      - lat: float
      - props: dict (JSON-serializable) [optional -> {}]
      - updatedAt: str (ISO-8601) [optional]
      - updatedBy: str [optional]
      - deleted: bool [optional]

    Tombstones (`deleted=true`) are applied as DELETE.
    Non-tombstones are applied as INSERT ... ON CONFLICT DO UPDATE.
    """

    if not re.match(r"^jgis_store_[a-z0-9_]+$", table_name):
        raise ValueError(f"Unexpected table name: {table_name}")

    payload = [
        {
            "id": f["id"],
            "lon": float(f["lon"]),
            "lat": float(f["lat"]),
            "props": f.get("props") or {},
            "updated_at": f.get("updatedAt"),
            "updated_by": f.get("updatedBy"),
            "deleted": bool(f.get("deleted", False)),
        }
        for f in features
    ]

    json_str = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    tag = f"jgis_payload_{uuid.uuid4().hex}"
    json_literal = _dollar_quote(tag, json_str)

    # Use set-based operations to avoid huge per-row SQL generation.
    #
    # Important Postgres detail:
    # A CTE defined with `WITH incoming AS (...)` only applies to the single
    # statement that immediately follows it. We therefore repeat the CTE
    # definition for DELETE and INSERT.
    return f"""
BEGIN;

WITH incoming AS (
  SELECT
    t.id::uuid AS id,
    t.lon::double precision AS lon,
    t.lat::double precision AS lat,
    COALESCE(t.props, '{{}}'::jsonb) AS props,
    COALESCE(t.updated_at::timestamptz, now()) AS updated_at,
    COALESCE(t.updated_by, '') AS updated_by,
    COALESCE(t.deleted, false) AS deleted
  FROM jsonb_to_recordset({json_literal}::jsonb)
    AS t(
      id text,
      lon double precision,
      lat double precision,
      props jsonb,
      updated_at text,
      updated_by text,
      deleted boolean
    )
)
DELETE FROM {table_name} dst
USING incoming src
WHERE dst.id = src.id
  AND src.deleted = true;

WITH incoming AS (
  SELECT
    t.id::uuid AS id,
    t.lon::double precision AS lon,
    t.lat::double precision AS lat,
    COALESCE(t.props, '{{}}'::jsonb) AS props,
    COALESCE(t.updated_at::timestamptz, now()) AS updated_at,
    COALESCE(t.updated_by, '') AS updated_by,
    COALESCE(t.deleted, false) AS deleted
  FROM jsonb_to_recordset({json_literal}::jsonb)
    AS t(
      id text,
      lon double precision,
      lat double precision,
      props jsonb,
      updated_at text,
      updated_by text,
      deleted boolean
    )
)
INSERT INTO {table_name} (id, geom, props, updated_at, updated_by)
SELECT
  src.id,
  ST_SetSRID(ST_MakePoint(src.lon, src.lat), 4326),
  src.props,
  src.updated_at,
  src.updated_by
FROM incoming src
WHERE src.deleted = false
ON CONFLICT (id) DO UPDATE SET
  geom = EXCLUDED.geom,
  props = EXCLUDED.props,
  updated_at = EXCLUDED.updated_at,
  updated_by = EXCLUDED.updated_by;

COMMIT;
""".strip()


def _psql_run(conn_url: str, sql: str) -> None:
    """
    Execute SQL using `psql` and raise a RuntimeError with real stderr.

    This is crucial for debugging fold failures (frontend should get the
    actual Postgres error message).
    """

    pg_connect_timeout = int(os.environ.get("JGIS_PG_CONNECT_TIMEOUT", "5"))
    psql_timeout = int(os.environ.get("JGIS_PSQL_TIMEOUT", "30"))

    try:
        subprocess.run(
            ["psql", conn_url, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-c", sql],
            check=True,
            timeout=psql_timeout,
            capture_output=True,
            text=True,
            env={
                **os.environ,
                # libpq env var: seconds to wait for a connection attempt.
                "PGCONNECT_TIMEOUT": str(pg_connect_timeout),
            },
        )
    except subprocess.CalledProcessError as e:
        stderr = (e.stderr or "").strip()
        stdout = (e.stdout or "").strip()
        msg = stderr or stdout or str(e)
        raise RuntimeError(msg) from e


def ensure_feature_store_table(conn_url: str, table_name: str) -> None:
    """Ensure the per-store table exists."""

    ddl = feature_store_table_ddl(table_name)
    sql = ddl

    _psql_run(conn_url, sql)


def merge_overlay_features_via_psql(
    conn_url: str,
    store_id: str,
    features: list[dict[str, Any]],
) -> None:
    """
    Merge overlay into PostGIS using `psql` subprocess calls.

    This is Phase 3.2 “fold” backend logic; Step 3.3 will wire it to HTTP.
    """

    if not conn_url:
        raise RuntimeError("JGIS_POSTGIS_URL is not configured")

    table_name = store_id_to_table_name(store_id)

    ensure_feature_store_table(conn_url, table_name)
    sql = merge_overlay_features_sql(table_name, features)

    _psql_run(conn_url, sql)

