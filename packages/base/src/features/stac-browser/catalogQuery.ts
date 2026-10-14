/** hydroweb.next STAC root. A trailing slash 404s. */
export const HYDROWEB_STAC_URL =
  'https://hydroweb.next.theia-land.fr/api/catalog/stac';

/** Catalog root with no trailing slash, so `/search` and `/collections` resolve. */
export function catalogRoot(url: string): string {
  return url.trim().replace(/\/+$/, '');
}
