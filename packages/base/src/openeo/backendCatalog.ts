import {
  connect,
  IOpenEOConnectionInfo,
} from '../mainview/OpenEOTileLayer';

export interface IFileFormat {
  id: string;
  title?: string;
  gis_data_types?: string[];
  parameters?: Record<string, any>;
  [key: string]: any;
}

export interface IBackendCatalog {
  collections: any[];
  processes: any[];
  outputFormats: IFileFormat[];
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
    const [cols, procs, formats] = await Promise.all([
      connection.listCollections(),
      connection.listProcesses(),
      // Older clients / backends may not expose listFileTypes — degrade
      // gracefully rather than failing the whole catalog fetch.
      (async () => {
        try {
          if (typeof (connection as any).listFileTypes === 'function') {
            return await (connection as any).listFileTypes();
          }
        } catch {
          /* ignore */
        }
        return null;
      })(),
    ]);
    // openeo-js-client wraps the /file_formats response in a FileTypes
    // class — the raw map lives at getOutputTypes() / .data.output, not
    // at .output directly.
    const outputRaw: Record<string, any> =
      (typeof (formats as any)?.getOutputTypes === 'function'
        ? (formats as any).getOutputTypes()
        : (formats as any)?.data?.output) ?? {};
    const outputFormats: IFileFormat[] = Object.keys(outputRaw).map(id => ({
      id,
      ...(outputRaw[id] ?? {}),
    }));
    return {
      collections: (cols as any)?.collections ?? [],
      processes: (procs as any)?.processes ?? [],
      outputFormats,
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
