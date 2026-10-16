import { MVT } from 'ol/format';
import RenderFeature from 'ol/render/Feature';

interface ITile {
  z: number;
  x: number;
  y: number;
}

export interface IVectorTileLayerDetectionOptions {
  /** Tile URL template with urlParameters / {max_zoom} already substituted. */
  url: string;
  minZoom?: number;
  maxZoom?: number;
  /** The current map view: tiles there are the most likely to contain data. */
  view?: { longitude: number; latitude: number; zoom: number };
  /** Override how tiles are requested, e.g. through the Jupyter proxy. */
  fetchTile?: (url: string) => Promise<Response>;
  signal?: AbortSignal;
}

const MAX_REQUESTS = 8;
const MAX_TILES_DECODED = 3;

const mvt = new MVT({ featureClass: RenderFeature });

function lonLatToTile(lon: number, lat: number, z: number): ITile {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  const clamp = (v: number) => Math.min(n - 1, Math.max(0, v));
  return { z, x: clamp(x), y: clamp(y) };
}

/** Tiles to try: around the current view, at a few zoom levels. */
function candidateTiles(o: IVectorTileLayerDetectionOptions): ITile[] {
  const lo = o.minZoom ?? 0;
  const hi = Math.max(lo, Math.min(o.maxZoom ?? 14, 14));
  const clamp = (z: number) => Math.min(hi, Math.max(lo, Math.round(z)));
  const center = o.view ?? { longitude: 0, latitude: 0, zoom: lo };

  const zooms = [
    ...new Set([clamp(center.zoom), lo, clamp((lo + hi) / 2), hi]),
  ];
  return zooms.map(z => lonLatToTile(center.longitude, center.latitude, z));
}

function fillTemplate(template: string, { z, x, y }: ITile): string {
  return template
    .replace(/\{z\}/g, String(z))
    .replace(/\{x\}/g, String(x))
    .replace(/\{-y\}/g, String(2 ** z - 1 - y))
    .replace(/\{y\}/g, String(y));
}

/** Servers sometimes send gzip bytes without a Content-Encoding header. */
async function toArrayBuffer(response: Response): Promise<ArrayBuffer> {
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Response(buffer).body!.pipeThrough(
      new DecompressionStream('gzip'),
    );
    return new Response(stream).arrayBuffer();
  }
  return buffer;
}

function readLayerNames(buffer: ArrayBuffer): string[] {
  const names = new Set<string>();
  for (const feature of mvt.readFeatures(buffer)) {
    const name = feature.get('layer');
    if (typeof name === 'string') {
      names.add(name);
    }
  }
  return [...names];
}

export async function detectVectorTileLayers(
  options: IVectorTileLayerDetectionOptions,
): Promise<string[]> {
  const fetcher =
    options.fetchTile ??
    ((url: string) => fetch(url, { signal: options.signal }));
  let template = options.url;
  let { minZoom, maxZoom } = options;

  if (/\.pmtiles(\.gz)?$/i.test(template)) {
    throw new Error('Detecting layers in PMTiles archives is not supported.');
  }

  // A URL with no {z}/{x}/{y} is a TileJSON document, not a tile template.
  if (!/\{(z|x|y|-y)\}/.test(template)) {
    const response = await fetcher(template);
    if (!response.ok) {
      throw new Error(`TileJSON request failed: ${response.status}`);
    }
    const tileJson = await response.json();
    const ids = (tileJson.vector_layers ?? [])
      .map((l: { id?: string }) => l.id)
      .filter((id: unknown): id is string => typeof id === 'string');
    if (ids.length > 0) {
      return ids; // cheapest path: no tile decoding needed
    }
    if (!tileJson.tiles?.[0]) {
      throw new Error('The TileJSON has no vector_layers or tile URLs.');
    }
    template = tileJson.tiles[0];
    minZoom ??= tileJson.minzoom;
    maxZoom ??= tileJson.maxzoom;
  }

  const found = new Set<string>();
  let decoded = 0;
  let requests = 0;
  let lastError: string | undefined;

  for (const tile of candidateTiles({ ...options, minZoom, maxZoom })) {
    if (requests >= MAX_REQUESTS || decoded >= MAX_TILES_DECODED) {
      break;
    }
    requests++;

    let response: Response;
    try {
      response = await fetcher(fillTemplate(template, tile));
    } catch (error) {
      if (options.signal?.aborted) {
        throw error;
      }
      lastError =
        'The tile server could not be reached (network error or CORS). ' +
        'If the server blocks browser requests, enable the proxy option.';
      continue;
    }

    if (!response.ok) {
      lastError = `Tile request failed (${response.status}).`;
      continue; // empty tiles are often 204/404, not a bad URL
    }

    try {
      const names = readLayerNames(await toArrayBuffer(response));
      if (names.length > 0) {
        names.forEach(name => found.add(name));
        decoded++;
      }
    } catch {
      lastError = 'The response was not a valid vector tile.';
    }
  }

  if (found.size === 0) {
    throw new Error(
      lastError ??
        'No layers found in the sampled tiles. Pan the map to where the data is and try again.',
    );
  }
  return [...found].sort();
}

/** Same substitutions the adapters' computeSourceUrl() performs. */
export function resolveTileUrlTemplate(params: {
  url?: string;
  urlParameters?: Record<string, string>;
  minZoom?: number;
  maxZoom?: number;
}): string {
  let url = params.url ?? '';

  for (const [name, value] of Object.entries(params.urlParameters ?? {})) {
    url = url.split(`{${name}}`).join(value);
  }
  if (params.maxZoom !== undefined) {
    url = url.split('{max_zoom}').join(String(params.maxZoom));
  }
  if (params.minZoom !== undefined) {
    url = url.split('{min_zoom}').join(String(params.minZoom));
  }
  return url;
}
