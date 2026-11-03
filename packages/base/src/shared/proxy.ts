import type { IJupyterGISModel } from '@jupytergis/schema';
import { PageConfig, URLExt } from '@jupyterlab/coreutils';

import { isJupyterLite } from '@/src/tools';

export const INTERNAL_PROXY_BASE = '/jupytergis_core/proxy';

let warnedAboutMissingProxy = false;

/**
 * The CORS proxy requests should go through, or null when there is none.
 *
 * The proxy setting wins when it is set. Otherwise JupyterLab goes through
 * the proxy served by the server extension, and JupyterLite has nothing to
 * fall back on.
 *
 * @param model - the JupyterGIS model, when one is available to read the
 *   setting from.
 */
export function getProxyEndpoint(model?: IJupyterGISModel): string | null {
  const settingUrl = model?.jgisSettings?.proxyUrl?.trim();
  if (settingUrl) {
    return `${settingUrl.replace(/\/+$/, '')}/`;
  }

  if (isJupyterLite()) {
    return null;
  }

  return URLExt.join(PageConfig.getBaseUrl(), INTERNAL_PROXY_BASE);
}

type CorsMode = 'direct' | 'proxy';

const CORS_DB_NAME = 'JupyterGISCorsCache';
const CORS_STORE_NAME = 'origins';

const corsModes = new Map<string, Promise<CorsMode>>();

function openCorsDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CORS_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(CORS_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCorsMode(origin: string): Promise<CorsMode | undefined> {
  const db = await openCorsDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(CORS_STORE_NAME, 'readonly')
      .objectStore(CORS_STORE_NAME)
      .get(origin);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeCorsMode(origin: string, mode: CorsMode): Promise<void> {
  const db = await openCorsDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CORS_STORE_NAME, 'readwrite');
    transaction.objectStore(CORS_STORE_NAME).put(mode, origin);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function probeCorsMode(url: string): Promise<CorsMode> {
  // Tile templates point at no real file, so ask for the first tile instead.
  const probeUrl = url.replace(/\{-?[xyz]\}/g, '0');
  try {
    const response = await fetch(probeUrl);
    await response.body?.cancel();
    return 'direct';
  } catch {
    return 'proxy';
  }
}

/**
 * Whether a request to a URL should go through the CORS proxy.
 *
 * With no proxy available, requests always go direct. Otherwise the first
 * request to a domain sends a GET to it: if the browser lets it through, the
 * domain is CORS friendly and is fetched directly from then on, else it is
 * fetched through the proxy. The answer is kept in IndexedDB per domain.
 * Requests that carry HTTP headers always use the proxy, since only the proxy
 * forwards them.
 *
 * @param model - the JupyterGIS model, to read the proxy setting from.
 * @param url - the URL about to be requested.
 * @param httpHeaders - HTTP headers the request needs, if any.
 */
export async function shouldUseProxy(
  model: IJupyterGISModel | undefined,
  url: string,
  httpHeaders?: string,
): Promise<boolean> {
  if (!getProxyEndpoint(model)) {
    return false;
  }

  let origin: string;
  try {
    const parsed = new URL(url, window.location.href);
    if (!parsed.protocol.startsWith('http')) {
      return false;
    }
    origin = parsed.origin;
  } catch {
    return false;
  }

  if (origin === window.location.origin) {
    return false;
  }

  if (httpHeaders && Object.keys(httpHeaders).length > 0) {
    return true;
  }

  let mode = corsModes.get(origin);
  if (!mode) {
    mode = (async () => {
      const stored = await readCorsMode(origin).catch(() => undefined);
      if (stored) {
        return stored;
      }
      const probed = await probeCorsMode(url);
      await writeCorsMode(origin, probed).catch(() => undefined);
      return probed;
    })();
    corsModes.set(origin, mode);
  }

  return (await mode) === 'proxy';
}

/**
 * Builds the proxy URL for a given URL.
 *
 * When no proxy is available the URL is returned as is, so the request fails
 * on the server that cannot be reached rather than on a proxy that does not
 * exist.
 *
 * @param model - the JupyterGIS model.
 * @param url - the URL to proxy.
 * @param useProxy - whether to use the proxy.
 * @param httpHeaders - HTTP headers to pass to the proxy.
 */
export function buildProxyUrl(
  model: IJupyterGISModel | undefined,
  url: string,
  useProxy?: boolean,
  httpHeaders?: string,
): string {
  if (!useProxy) {
    return url;
  }

  const proxyBase = getProxyEndpoint(model);
  if (!proxyBase) {
    // Tile loaders come through here once per tile, so say it once.
    if (!warnedAboutMissingProxy) {
      warnedAboutMissingProxy = true;
      console.warn(
        `No proxy available, requesting ${url} directly. Set the proxy URL in the JupyterGIS settings to use one.`,
      );
    }
    return url;
  }

  const headersParam =
    httpHeaders && Object.keys(httpHeaders).length > 0
      ? `&headers=${encodeURIComponent(JSON.stringify(httpHeaders))}`
      : '';

  return `${proxyBase}?url=${encodeURIComponent(url)}${headersParam}`;
}
