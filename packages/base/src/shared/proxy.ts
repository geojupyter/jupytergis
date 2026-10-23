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
