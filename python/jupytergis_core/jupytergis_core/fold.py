"""Server-side fold of collaborative overlay into PostGIS (Y as the bus)."""

from __future__ import annotations

import logging
from typing import Any, Callable

from pycrdt import Doc, Map

from .postgis import (
    ensure_feature_store_table,
    get_postgis_url,
    merge_overlay_features_via_psql,
    store_id_to_table_name,
)

logger = logging.getLogger(__name__)

TIPG_FEATURE_STORE_SCHEMA = "public"


def build_collaborative_point_tile_url_template(
    store_id: str,
    baseline_version: int = 0,
) -> str:
    """Relative MVT URL template for the Jupyter tipg proxy."""

    collection_id = (
        f"{TIPG_FEATURE_STORE_SCHEMA}.{store_id_to_table_name(store_id)}"
    )

    return (
        "jupytergis_core/tiles/collections/"
        f"{collection_id}/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}"
        f"?v={baseline_version}"
    )


def _plain_meta(store: Map) -> dict[str, Any]:
    meta = store.get("meta")
    if isinstance(meta, Map):
        return dict(meta.to_py() or {})

    if isinstance(meta, dict):
        return dict(meta)

    return {}


def _write_meta(store: Map, **updates: Any) -> None:
    meta = _plain_meta(store)
    meta.update(updates)
    store["meta"] = meta


def _features_as_list(store: Map) -> list[dict[str, Any]]:
    features = store.get("features")
    if isinstance(features, Map):
        plain = features.to_py() or {}
    elif isinstance(features, dict):
        plain = features
    else:
        return []

    result: list[dict[str, Any]] = []
    for feature_id, feature in plain.items():
        if not isinstance(feature, dict):
            continue
        row = dict(feature)
        row.setdefault("id", feature_id)
        result.append(row)
        
    return result


def _copy_and_release_overlay(ydoc: Doc, store: Map) -> list[dict[str, Any]]:
    """Short lock: compacting → snapshot → clear overlay and flags."""

    with ydoc.transaction():
        _write_meta(store, compacting=True)

    snapshot = _features_as_list(store)

    with ydoc.transaction():
        features = store.get("features")
        if isinstance(features, Map):
            features.clear()
        else:
            store["features"] = Map()
        _write_meta(store, compacting=False, foldRequested=False)

    return snapshot


def bump_collaborative_point_sources(ysources: Map, store_id: str) -> None:
    """Bump baselineVersion / tileUrlTemplate on matching sources."""

    for source_id in list(ysources):
        source = ysources.get(source_id)
        if isinstance(source, Map):
            plain = source.to_py() or {}
        elif isinstance(source, dict):
            plain = dict(source)
        else:
            continue

        if plain.get("type") != "CollaborativePointSource":
            continue

        params = dict(plain.get("parameters") or {})
        if params.get("storeId") != store_id:
            continue

        next_version = int(params.get("baselineVersion") or 0) + 1
        params["baselineVersion"] = next_version
        params["tileUrlTemplate"] = build_collaborative_point_tile_url_template(
            store_id,
            next_version,
        )

        ysources[source_id] = {**plain, "parameters": params}


class FeatureStoreFold:
    """Observe featureStores and fold when a client sets foldRequested.

    Not wired through YJGIS.observe() — that persist callback would dirty
    the .jGIS file on every overlay point.
    """

    def __init__(
        self,
        ydoc: Doc,
        yfeature_stores: Map,
        ysources: Map,
    ) -> None:
        self._ydoc = ydoc
        self._yfeature_stores = yfeature_stores
        self._ysources = ysources
        self._in_flight: set[str] = set()
        self._subscription = yfeature_stores.observe_deep(self._on_change)

    def _on_change(self, _events: list[Any]) -> None:
        self._schedule(self._scan)

    def _schedule(self, callback: Callable[..., Any], *args: Any) -> None:
        try:
            from tornado.ioloop import IOLoop

            IOLoop.current().add_callback(callback, *args)
        except Exception:
            logger.exception(
                "Could not schedule collaborative fold callback",
            )

    def _scan(self) -> None:
        for store_id in list(self._yfeature_stores):
            self._maybe_begin_fold(store_id)

    def _maybe_begin_fold(self, store_id: str) -> None:
        if store_id in self._in_flight:
            print(f"[fold] {store_id}: in flight, skipping")
            return

        store = self._yfeature_stores.get(store_id)
        if not isinstance(store, Map):
            print(f"[fold] {store_id}: store is {type(store)}, not a Map")
            return

        meta = _plain_meta(store)
        print(f"[fold] {store_id}: meta={meta}")
        if not meta.get("foldRequested"):
            return

        conn_url = get_postgis_url()
        if not conn_url:
            logger.warning(
                "Fold requested for store %s but JGIS_POSTGIS_URL is unset",
                store_id,
            )
            with self._ydoc.transaction():
                _write_meta(store, foldRequested=False)
            return

        self._in_flight.add(store_id)
        try:
            snapshot = _copy_and_release_overlay(self._ydoc, store)
        except Exception:
            self._in_flight.discard(store_id)
            logger.exception(
                "Failed to snapshot/clear overlay for store %s",
                store_id,
            )
            return

        self._schedule(self._run_fold, store_id, snapshot, conn_url)

    async def _run_fold(
        self,
        store_id: str,
        snapshot: list[dict[str, Any]],
        conn_url: str,
    ) -> None:
        from tornado.ioloop import IOLoop

        from .handler import refresh_tipg_catalog

        try:
            table_name = store_id_to_table_name(store_id)
            await IOLoop.current().run_in_executor(
                None,
                ensure_feature_store_table,
                conn_url,
                table_name,
            )
            if snapshot:
                await IOLoop.current().run_in_executor(
                    None,
                    merge_overlay_features_via_psql,
                    conn_url,
                    store_id,
                    snapshot,
                )
            # Refresh before bump so clients hit a catalog that knows the table.
            await refresh_tipg_catalog()
            if snapshot:
                with self._ydoc.transaction():
                    bump_collaborative_point_sources(
                        self._ysources,
                        store_id,
                    )
        except Exception:
            logger.exception(
                "Collaborative overlay fold failed for store %s",
                store_id,
            )
        finally:
            self._in_flight.discard(store_id)
            self._scan()
