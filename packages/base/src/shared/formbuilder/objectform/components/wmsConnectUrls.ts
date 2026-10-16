/** Service root saved on the layer, and the GetCapabilities URL to fetch. */
export function wmsConnectUrls(text: string): {
  root: string;
  capabilitiesUrl: string;
} {
  const parsed = new URL(text.trim());
  const root = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');

  if (!parsed.search) {
    return {
      root,
      capabilitiesUrl: `${root}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`,
    };
  }

  if (!hasSearchParam(parsed, 'SERVICE')) {
    parsed.searchParams.set('SERVICE', 'WMS');
  }
  if (!hasSearchParam(parsed, 'VERSION')) {
    parsed.searchParams.set('VERSION', '1.3.0');
  }
  if (!hasSearchParam(parsed, 'REQUEST')) {
    parsed.searchParams.set('REQUEST', 'GetCapabilities');
  }

  return { root, capabilitiesUrl: parsed.toString() };
}

function hasSearchParam(url: URL, name: string): boolean {
  const target = name.toLowerCase();
  for (const key of url.searchParams.keys()) {
    if (key.toLowerCase() === target) {
      return true;
    }
  }
  return false;
}
