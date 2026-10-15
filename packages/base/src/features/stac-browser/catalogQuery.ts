import { IStacAsset, IStacLink } from '@/src/features/stac-browser/types/types';

/** Service URL and layer name taken from a collection WMS asset. */
export interface ICatalogWmsEndpoint {
  url: string;
  layers: string;
  name: string;
}

/** hydroweb.next STAC root. A trailing slash 404s. */
export const HYDROWEB_STAC_URL =
  'https://hydroweb.next.theia-land.fr/api/catalog/stac';

const PREVIEW_ROLES = ['overview', 'thumbnail'];

/** Catalog root with no trailing slash, so `/search` and `/collections` resolve. */
export function catalogRoot(url: string): string {
  return url.trim().replace(/\/+$/, '');
}
/**
 * A collection WMS asset href is a full GetMap URL. TileWMS builds its own
 * GetMap request, so only the service root and `layers` parameter are kept.
 * Assets without `layers` (capabilities, thumbnails) are skipped.
 */
export function wmsEndpointFromAsset(
  asset: Pick<IStacAsset, 'href' | 'title' | 'roles'>,
  key: string,
): ICatalogWmsEndpoint | null {
  if (!asset.href || !asset.roles?.includes('wms')) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(asset.href);
  } catch {
    return null;
  }

  const layers =
    parsed.searchParams.get('layers') ?? parsed.searchParams.get('LAYERS');
  if (!layers) {
    return null;
  }

  return {
    url: `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, ''),
    layers,
    name: asset.title || key,
  };
}

/**
 * Preview image for a collection card.
 * Tries an `overview` asset, then a `thumbnail` asset,
 * then a link with rel `preview`.
 */
export function pickCollectionPreview(
  assets: Record<string, IStacAsset> | undefined,
  links: IStacLink[] = [],
): string | null {
  for (const role of PREVIEW_ROLES) {
    const match = Object.values(assets ?? {}).find(
      asset => Boolean(asset.href) && asset.roles?.includes(role),
    );

    if (match?.href) {
      return match.href;
    }
  }

  const previewLink = links.find(
    link => link.rel === 'preview' && Boolean(link.href),
  );

  return previewLink?.href ?? null;
}

/** Collapse markup and extra whitespace so a description can be shown as text. */
export function collectionPlainText(value: string | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every WMS layer on a collection. Water-surface-elevation layers come first. */
export function listCollectionWms(
  assets: Record<string, IStacAsset> | undefined,
): ICatalogWmsEndpoint[] {
  if (!assets) {
    return [];
  }

  const endpoints = Object.entries(assets)
    .map(([key, asset]) => wmsEndpointFromAsset(asset, key))
    .filter((endpoint): endpoint is ICatalogWmsEndpoint => endpoint !== null);

  return [
    ...endpoints.filter(endpoint => endpoint.layers.endsWith('_wse')),
    ...endpoints.filter(endpoint => !endpoint.layers.endsWith('_wse')),
  ];
}

/** The layer added when a search result has no layer choice of its own. */
export function pickCollectionWms(
  assets: Record<string, IStacAsset> | undefined,
): ICatalogWmsEndpoint | null {
  return listCollectionWms(assets)[0] ?? null;
}
