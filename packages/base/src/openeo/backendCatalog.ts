import {
  connect,
  IOpenEOConnectionInfo,
} from '../mainview/OpenEOTileLayer';

export interface IBackendCatalog {
  collections: any[];
  processes: any[];
}

const _catalogCache = new Map<string, Promise<IBackendCatalog>>();

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}

/**
 * Fetch (and cache) the backend's process + collection catalog. Used to
 * give the ModelBuilder port labels and type-aware validation.
 *
 * Connection (and sign-in) is delegated to the shared `connect` helper in
 * OpenEOTileLayer, which also populates `connectionInfo.authBearer` once the
 * user has authenticated.
 */
export async function fetchBackendCatalog(
  connectionInfo: IOpenEOConnectionInfo,
): Promise<IBackendCatalog> {
  const key = normalizeUrl(connectionInfo.url ?? '');
  const existing = _catalogCache.get(key);
  if (existing) {
    return existing;
  }
  const promise = (async (): Promise<IBackendCatalog> => {
    const connection = await connect(connectionInfo);
    const [cols, procs] = await Promise.all([
      connection.listCollections(),
      connection.listProcesses(),
    ]);
    return {
      collections: (cols as any)?.collections ?? [],
      processes: (procs as any)?.processes ?? [],
    };
  })();
  _catalogCache.set(key, promise);
  try {
    return await promise;
  } catch (err) {
    _catalogCache.delete(key);
    throw err;
  }
}

/**
 * Manually seed the cache. The Discovery panel calls this after the
 * user connects so the dialog can reuse the data without a second
 * round-trip.
 */
export function seedBackendCatalog(
  url: string,
  catalog: IBackendCatalog,
): void {
  const key = normalizeUrl(url);
  _catalogCache.set(key, Promise.resolve(catalog));
}
