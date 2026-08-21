/**
 * Feature-store helpers: limits, PostGIS naming, and overlay CRUD
 * helpers used by the Ydoc layer.
 */

import type {
  IFeatureStoreFeature,
  IFeatureStoreFeatureProps,
  IFeatureStoreGeometry,
  IFeatureStore,
  IFeatureStoreMeta,
} from './types';

export type FeatureStoreAddBlockReason = 'hardLimit' | 'compacting';

/** Warn when overlay feature count reaches this size. */
export const FEATURE_STORE_SOFT_LIMIT = 40_000;

/** Block new overlay features at this size until fold. */
export const FEATURE_STORE_HARD_LIMIT = 50_000;

/** PostgreSQL table name prefix for per-store baseline tables. */
export const FEATURE_STORE_TABLE_PREFIX = 'jgis_store_';

/** tipg / PostGIS schema that owns `jgis_store_*` tables. */
export const TIPG_FEATURE_STORE_SCHEMA = 'public';

/**
 * Max length of the slug after the table prefix.
 * PostgreSQL identifiers are capped at 63 bytes.
 */
export const FEATURE_STORE_SLUG_MAX_LENGTH =
  63 - FEATURE_STORE_TABLE_PREFIX.length;

const UUID_HEX = /^[0-9a-f]{32}$/;
const SLUG = /^[a-z][a-z0-9_]*$/;

export function defaultFeatureStoreMeta(
  overrides: Partial<IFeatureStoreMeta> = {},
): IFeatureStoreMeta {
  return {
    softLimit: FEATURE_STORE_SOFT_LIMIT,
    hardLimit: FEATURE_STORE_HARD_LIMIT,
    compacting: false,
    foldRequested: false,
    ...overrides,
  };
}

/**
 * Normalize a store id to a safe lowercase slug for use in table names.
 *
 * - UUID (with or without dashes) → 32 hex chars
 * - Otherwise: lowercase, non [a-z0-9_] → `_`, must start with a letter
 *
 * @throws If the id is empty or cannot be sanitized within length limits.
 */
export function normalizeStoreIdSlug(storeId: string): string {
  const trimmed = storeId.trim().toLowerCase();
  if (!trimmed) {
    throw new Error('storeId is required');
  }

  const uuidHex = trimmed.replace(/-/g, '');
  if (UUID_HEX.test(uuidHex)) {
    return uuidHex;
  }

  const slug = trimmed
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (!slug || !SLUG.test(slug)) {
    throw new Error(
      `storeId "${storeId}" cannot be converted to a safe table slug ` +
        '(use a UUID or an identifier starting with a letter)',
    );
  }

  if (slug.length > FEATURE_STORE_SLUG_MAX_LENGTH) {
    throw new Error(
      `storeId slug exceeds ${FEATURE_STORE_SLUG_MAX_LENGTH} characters ` +
        `after sanitization (got ${slug.length})`,
    );
  }

  return slug;
}

/**
 * Map a feature-store id to its PostGIS table name
 * (`jgis_store_<slug>`).
 */
export function storeIdToTableName(storeId: string): string {
  return `${FEATURE_STORE_TABLE_PREFIX}${normalizeStoreIdSlug(storeId)}`;
}

/**
 * tipg collection id for a feature store
 * (`public.jgis_store_<slug>`).
 */
export function storeIdToTipgCollectionId(storeId: string): string {
  return `${TIPG_FEATURE_STORE_SCHEMA}.${storeIdToTableName(storeId)}`;
}

/**
 * Relative MVT URL template for the Jupyter tipg proxy.
 *
 * Prefix with the Jupyter server `baseUrl` at runtime. Includes `?v=` for
 * cache busting when `baselineVersion` changes after fold.
 */
export function buildFeatureStoreTileUrlTemplate(
  storeId: string,
  baselineVersion = 0,
): string {
  const collectionId = storeIdToTipgCollectionId(storeId);
  return (
    `jupytergis_core/tiles/collections/${collectionId}` +
    `/tiles/WebMercatorQuad/{z}/{x}/{y}?v=${baselineVersion}`
  );
}

/**
 * Return DDL to create a per-store baseline table and its spatial index.
 * `tableName` must already be a validated identifier from
 * {@link storeIdToTableName}.
 */
export function featureStoreTableDdl(tableName: string): string {
  if (!/^jgis_store_[a-z0-9_]+$/.test(tableName)) {
    throw new Error(`Refusing DDL for unexpected table name: ${tableName}`);
  }

  const indexName = `${tableName}_geom_gix`;
  return [
    `CREATE TABLE IF NOT EXISTS ${tableName} (`,
    '  id uuid PRIMARY KEY,',
    '  geom geometry(Geometry, 4326) NOT NULL,',
    "  props jsonb NOT NULL DEFAULT '{}'::jsonb,",
    '  updated_at timestamptz NOT NULL DEFAULT now(),',
    '  updated_by text',
    ');',
    `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} USING GIST (geom);`,
  ].join('\n');
}

/** Count non-tombstone overlay features. */
export function countLiveOverlayFeatures(
  features: Record<string, IFeatureStoreFeature>,
): number {
  let count = 0;
  for (const feature of Object.values(features)) {
    if (!feature.deleted) {
      count += 1;
    }
  }

  return count;
}

export function getOverlayAddBlockReason(
  store: IFeatureStore,
): FeatureStoreAddBlockReason | undefined {
  if (store.meta.compacting) {
    return 'compacting';
  }

  if (countLiveOverlayFeatures(store.features) >= store.meta.hardLimit) {
    return 'hardLimit';
  }

  return undefined;
}

export function isOverlayNearSoftLimit(store: IFeatureStore): boolean {
  return countLiveOverlayFeatures(store.features) >= store.meta.softLimit;
}

export function buildFeatureStoreFeature(args: {
  id: string;
  geometry: IFeatureStoreGeometry;
  props?: IFeatureStoreFeatureProps;
  updatedBy: string;
  updatedAt?: string;
  deleted?: boolean;
}): IFeatureStoreFeature {
  return {
    id: args.id,
    geometry: args.geometry,
    props: args.props ?? {},
    updatedAt: args.updatedAt ?? new Date().toISOString(),
    updatedBy: args.updatedBy,
    ...(args.deleted ? { deleted: true } : {}),
  };
}
