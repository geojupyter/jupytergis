import type { IJupyterGISModel } from '@jupytergis/schema';

import { INTERNAL_PROXY_BASE, isJupyterLite } from '@/src/tools';

/**
 * Builds the proxy URL for a given URL.
 * @param model - the JupyterGIS model.
 * @param url - the URL to proxy.
 * @param useProxy - whether to use the proxy.
 * @param httpHeaders - HTTP headers to pass to the proxy.
 */

export function buildProxyUrl(
  model: IJupyterGISModel,
  url: string,
  useProxy?: boolean,
  httpHeaders?: string,
): string {
  if (!useProxy) {
    return url;
  }
  const headersParam =
    httpHeaders && Object.keys(httpHeaders).length > 0
      ? `&headers=${encodeURIComponent(JSON.stringify(httpHeaders))}`
      : '';

  const proxyBase = isJupyterLite()
    ? `${model.jgisSettings.proxyUrl}/`
    : INTERNAL_PROXY_BASE;

  return `${proxyBase}?url=${encodeURIComponent(url)}${headersParam}`;
}
