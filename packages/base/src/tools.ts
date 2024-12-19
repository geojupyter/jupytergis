import Protobuf from 'pbf';

import { VectorTile } from '@mapbox/vector-tile';

import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import * as d3Color from 'd3-color';

import {
  IDict,
  IJGISLayerBrowserRegistry,
  IJGISOptions,
  IRasterLayerGalleryEntry
} from '@jupytergis/schema';
import RASTER_LAYER_GALLERY from '../rasterlayer_gallery/raster_layer_gallery.json';
import { getGdal } from './gdal';

export const debounce = (
  func: CallableFunction,
  timeout = 100
): CallableFunction => {
  let timeoutId: number;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      func(...args);
    }, timeout);
  };
};

export function throttle<T extends (...args: any[]) => void>(
  callback: T,
  delay = 100
): T {
  let last: number;
  let timer: any;
  return function (...args: any[]) {
    const now = +new Date();
    if (last && now < last + delay) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        last = now;
        callback(...args);
      }, delay);
    } else {
      last = now;
      callback(...args);
    }
  } as T;
}

export function getElementFromProperty(
  filePath?: string | null,
  prop?: string | null
): HTMLElement | undefined | null {
  if (!filePath || !prop) {
    return;
  }
  const parent = document.querySelector(`[data-path="${filePath}"]`);

  if (parent) {
    const el = parent.querySelector(`[id$=${prop}]`);
    return el as HTMLElement;
  }
}

export function nearest(n: number, tol: number): number {
  const round = Math.round(n);
  if (Math.abs(round - n) < tol) {
    return round;
  } else {
    return n;
  }
}

export function getCSSVariableColor(name: string): string {
  const color =
    window.getComputedStyle(document.body).getPropertyValue(name) || '#ffffff';

  return d3Color.rgb(color).formatHex();
}

/**
 * Call the API extension
 *
 * @param endPoint API REST end point for the extension
 * @param init Initial values for the request
 * @returns The response body interpreted as JSON
 */
export async function requestAPI<T>(
  endPoint = '',
  init: RequestInit = {}
): Promise<T> {
  // Make request to Jupyter API
  const settings = ServerConnection.makeSettings();
  const requestUrl = URLExt.join(settings.baseUrl, endPoint);

  let response: Response;
  try {
    response = await ServerConnection.makeRequest(requestUrl, init, settings);
  } catch (error) {
    throw new ServerConnection.NetworkError(error as any);
  }

  let data: any = await response.text();

  if (data.length > 0) {
    try {
      data = JSON.parse(data);
    } catch (error) {
      console.log('Not a JSON response body.', response);
    }
  }

  if (!response.ok) {
    throw new ServerConnection.ResponseError(response, data.message || data);
  }

  return data;
}

export function isLightTheme(): boolean {
  return document.body.getAttribute('data-jp-theme-light') === 'true';
}

export function deepCopy<T = IDict<any>>(value: T): T {
  if (!value) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

/**
 * Create a default layer registry
 *
 * @param layerBrowserRegistry Registry to add layers to
 */
export function createDefaultLayerRegistry(
  layerBrowserRegistry: IJGISLayerBrowserRegistry
): void {
  const RASTER_THUMBNAILS: { [key: string]: string } = {};

  /**
   * Generate object to hold thumbnail URLs
   */
  const importAll = (r: __WebpackModuleApi.RequireContext) => {
    r.keys().forEach(key => {
      const imageName = key.replace('./', '').replace(/\.\w+$/, '');
      RASTER_THUMBNAILS[imageName] = r(key);
    });
  };

  const context = require.context(
    '../rasterlayer_gallery',
    false,
    /\.(png|jpe?g|gif|svg)$/
  );
  importAll(context);

  for (const entry of Object.keys(RASTER_LAYER_GALLERY)) {
    const xyzprovider: any = (RASTER_LAYER_GALLERY as any)[entry];

    if ('url' in xyzprovider) {
      const tile = convertToRegistryEntry(entry, xyzprovider);
      layerBrowserRegistry.addRegistryLayer(tile);
    } else {
      Object.keys(xyzprovider).forEach(mapName => {
        const tile = convertToRegistryEntry(
          xyzprovider[mapName]['name'],
          xyzprovider[mapName],
          entry
        );

        layerBrowserRegistry.addRegistryLayer(tile);
      });
    }
  }

  // TODO: These need better names
  /**
   * Parse tile information from providers to be useable in the layer registry
   *
   * @param entry - The name of the entry, which may also serve as the default provider name if none is specified.
   * @param xyzprovider - An object containing the XYZ provider's details, including name, URL, zoom levels, attribution, and possibly other properties relevant to the provider.
   * @param provider - Optional. Specifies the provider name. If not provided, the `entry` parameter is used as the default provider name.
   * @returns - An object representing the registry entry
   */
  function convertToRegistryEntry(
    entry: string,
    xyzprovider: { [x: string]: any },
    provider?: string | undefined
  ): IRasterLayerGalleryEntry {
    const urlParameters: any = {};
    if (xyzprovider.time) {
      urlParameters.time = xyzprovider.time;
    }
    if (xyzprovider.variant) {
      urlParameters.variant = xyzprovider.variant;
    }
    if (xyzprovider.tilematrixset) {
      urlParameters.tilematrixset = xyzprovider.tilematrixset;
    }
    if (xyzprovider.format) {
      urlParameters.format = xyzprovider.format;
    }

    return {
      name: entry,
      thumbnail: RASTER_THUMBNAILS[xyzprovider['name'].replace('.', '-')],
      source: {
        url: xyzprovider['url'],
        minZoom: xyzprovider['min_zoom'] || 0,
        maxZoom: xyzprovider['max_zoom'] || 24,
        attribution: xyzprovider['attribution'] || '',
        provider: provider ?? entry,
        urlParameters
      }
    };
  }
}

// Get x/y tile values from lat and lng
// Based on https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Mathematics
function getTileCoordinates(latDeg: number, lonDeg: number, zoom: number) {
  const latRad = latDeg * (Math.PI / 180);
  const n = 1 << zoom;
  const xTile = Math.floor(((lonDeg + 180.0) / 360.0) * n);
  const yTile = Math.floor(
    (n * (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI)) / 2
  );

  // Check if either xTile or yTile is NaN
  if (isNaN(xTile) || isNaN(yTile)) {
    return { xTile: 0, yTile: 0 };
  }

  return { xTile, yTile };
}

export async function getLayerTileInfo(
  tileUrl: string,
  mapOptions: Pick<IJGISOptions, 'latitude' | 'longitude' | 'extent' | 'zoom'>,
  urlParameters?: IDict<string>
): Promise<VectorTile> {
  // If it's tilejson, fetch the json to access the pbf url
  if (tileUrl.includes('.json')) {
    const response = await fetch(tileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch json: ${response.statusText}`);
    }

    const json = await response.json();
    tileUrl = json.tiles[0];
  }

  const latitude = mapOptions.extent
    ? (mapOptions.extent[1] + mapOptions.extent[3]) / 2
    : mapOptions.latitude || 0;
  const longitude = mapOptions.extent
    ? (mapOptions.extent[0] + mapOptions.extent[2]) / 2
    : mapOptions.longitude || 0;
  const zoom = mapOptions.zoom || 0;

  const { xTile, yTile } = getTileCoordinates(latitude, longitude, zoom);

  // Replace url params with currently viewed tile
  tileUrl = tileUrl
    .replace('{z}', String(Math.floor(zoom)))
    .replace('{x}', String(xTile))
    .replace('{y}', String(yTile));

  if (urlParameters) {
    for (const param of Object.keys(urlParameters)) {
      tileUrl = tileUrl.replace(`{${param}}`, urlParameters[param]);
    }
  }

  const response = await fetch(tileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch tile: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const tile = new VectorTile(new Protobuf(arrayBuffer));

  return tile;
}

export async function getSourceLayerNames(
  tileUrl: string,
  urlParameters?: IDict<string>
) {
  const tile = await getLayerTileInfo(
    tileUrl,
    { latitude: 0, longitude: 0, zoom: 0, extent: [] },
    urlParameters
  );

  const layerNames = Object.keys(tile.layers);

  return layerNames;
}

export interface IParsedStyle {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  joinStyle: string;
  capStyle: string;
  radius?: number;
}

export function parseColor(type: string, style: any) {
  if (!type || !style) {
    return;
  }

  const type2 = type === 'circle' ? 'circle' : 'default';

  const shapeStyles: any = {
    circle: {
      radius: style['circle-radius'] ?? 5,
      fillColor: style['circle-fill-color'] ?? '#3399CC',
      strokeColor: style['circle-stroke-color'] ?? '#3399CC',
      strokeWidth: style['circle-stroke-width'] ?? 1.25,
      joinStyle: style['circle-stroke-line-join'] ?? 'round',
      capStyle: style['circle-stroke-line-cap'] ?? 'round'
    },
    default: {
      fillColor: style['fill-color'] ?? '[255, 255, 255, 0.4]',
      strokeColor: style['stroke-color'] ?? '#3399CC',
      strokeWidth: style['stroke-width'] ?? 1.25,
      capStyle: style['stroke-line-cap'] ?? 'round',
      joinStyle: style['stroke-line-join'] ?? 'round'
    }
  };

  const parsedStyle: IParsedStyle = shapeStyles[type2];

  Object.assign(parsedStyle, {
    radius: parsedStyle.radius,
    fillColor: parsedStyle.fillColor,
    strokeColor: parsedStyle.strokeColor,
    strokeWidth: parsedStyle.strokeWidth,
    joinStyle: parsedStyle.joinStyle,
    capStyle: parsedStyle.capStyle
  });

  return parsedStyle;
}

/**
 * Open or create an IndexedDB database for caching GeoTIFF files.
 *
 * @returns A promise that resolves to the opened IndexedDB database instance.
 */
export const openDatabase = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('GeoTIFFCache', 1);

    request.onupgradeneeded = event => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'url' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Save a file and its metadata to the IndexedDB database.
 *
 * @param key file ID (sourceUrl).
 * @param file Blob object representing the file content.
 * @param metadata metadata of file.
 * @returns A promise that resolves once the data is successfully saved.
 */
export const saveToIndexedDB = async (
  key: string,
  file: Blob,
  metadata: any
) => {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite');
    const store = transaction.objectStore('files');
    store.put({ url: key, file, metadata });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

/**
 * Retrieve a file and its metadata from the IndexedDB database.
 *
 * @param key fileID (sourceUrl).
 * @returns A promise that resolves to the stored data object or undefined.
 */
export const getFromIndexedDB = async (key: string) => {
  const db = await openDatabase();
  return new Promise<any>((resolve, reject) => {
    const transaction = db.transaction('files', 'readonly');
    const store = transaction.objectStore('files');
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Load a GeoTIFF file from IndexedDB database cache or fetch it .
 *
 * @param sourceInfo object containing the URL of the GeoTIFF file.
 * @returns A promise that resolves to the file as a Blob, or undefined .
 */
export const loadGeoTIFFWithCache = async (sourceInfo: {
  url?: string | undefined;
}) => {
  if (!sourceInfo?.url) {
    return null;
  }

  const cachedData = await getFromIndexedDB(sourceInfo.url);
  if (cachedData) {
    return {
      file: new Blob([cachedData.file]),
      metadata: cachedData.metadata,
      sourceUrl: sourceInfo.url
    };
  }

  const response = await fetch(sourceInfo.url);
  const fileBlob = await response.blob();
  const file = new File([fileBlob], 'loaded.tif');

  const Gdal = await getGdal();
  const result = await Gdal.open(file);
  const tifDataset = result.datasets[0];
  const metadata = await Gdal.gdalinfo(tifDataset, ['-stats']);
  Gdal.close(tifDataset);

  await saveToIndexedDB(sourceInfo.url, fileBlob, metadata);

  return {
    file: fileBlob,
    metadata,
    sourceUrl: sourceInfo.url
  };
};
