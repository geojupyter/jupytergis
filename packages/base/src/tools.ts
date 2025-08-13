import {
  IDict,
  IJGISLayerBrowserRegistry,
  IJGISOptions,
  IJGISSource,
  IJupyterGISModel,
  IRasterLayerGalleryEntry,
  SourceType,
} from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { PathExt, URLExt } from '@jupyterlab/coreutils';
import { Contents, ServerConnection } from '@jupyterlab/services';
import { VectorTile } from '@mapbox/vector-tile';
import { GeoPackageAPI, GeoPackageTileRetriever } from '@ngageoint/geopackage';
import * as d3Color from 'd3-color';
import { compressors } from 'hyparquet-compressors';
import { Source } from 'ol/source';
import loadGpkg from 'ol-load-geopackage';
import Protobuf from 'pbf';
import shp from 'shpjs';
import { getGdal } from './gdal';

import RASTER_LAYER_GALLERY from '@/rasterlayer_gallery/raster_layer_gallery.json';

export const debounce = (
  func: CallableFunction,
  timeout = 100,
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
  delay = 100,
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
  prop?: string | null,
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
  init: RequestInit = {},
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
  layerBrowserRegistry: IJGISLayerBrowserRegistry,
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
    /\.(png|jpe?g|gif|svg)$/,
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
          entry,
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
    provider?: string | undefined,
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
        urlParameters,
      },
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
    (n * (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI)) / 2,
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
  urlParameters?: IDict<string>,
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

export interface IParsedStyle {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  joinStyle: string;
  capStyle: string;
  radius?: number;
}

export function parseColor(style: any): IParsedStyle | undefined {
  if (!style) {
    return;
  }

  const parsedStyle: IParsedStyle = {
    radius: style['circle-radius'] ?? 5,
    fillColor: style['circle-fill-color'] ?? style['fill-color'] ?? '#3399CC',
    strokeColor:
      style['circle-stroke-color'] ?? style['stroke-color'] ?? '#3399CC',
    strokeWidth: style['circle-stroke-width'] ?? style['stroke-width'] ?? 1.25,
    joinStyle:
      style['circle-stroke-line-join'] ?? style['stroke-line-join'] ?? 'round',
    capStyle:
      style['circle-stroke-line-cap'] ?? style['stroke-line-cap'] ?? 'round',
  };

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
  file: any,
  metadata?: any | undefined,
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
  return new Promise<
    | {
        file: any;
        metadata?: any | undefined;
      }
    | undefined
  >((resolve, reject) => {
    const transaction = db.transaction('files', 'readonly');
    const store = transaction.objectStore('files');
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const isJupyterLite = () => {
  return document.querySelectorAll('[data-jupyter-lite-root]')[0] !== undefined;
};

type ProxyStrategy = 'direct' | 'internal' | 'external';

export const fetchWithProxies = async <T>(
  url: string,
  model: IJupyterGISModel,
  parseResponse: (response: Response) => Promise<T>,
  options?: RequestInit,
  strategy?: ProxyStrategy,
): Promise<T | null> => {
  let settings: any = null;

  if (model) {
    try {
      settings = model.getSettings();
    } catch (e) {
      console.warn('Failed to get settings from model. Falling back.', e);
    }
  }

  const proxyUrl =
    settings && settings.proxyUrl ? settings.proxyUrl : 'https://corsproxy.io';

  const strategies: Record<ProxyStrategy, (url: string) => string> = {
    direct: url => url,
    internal: url => `/jupytergis_core/proxy?url=${encodeURIComponent(url)}`,
    external: url => `${proxyUrl}/?url=${encodeURIComponent(url)}`,
  };

  const defaultOrder: ProxyStrategy[] = ['direct', 'internal', 'external'];

  const strategyOrder: ProxyStrategy[] = strategy ? [strategy] : defaultOrder;

  for (const strat of strategyOrder) {
    const proxyUrl = strategies[strat](url);
    try {
      const response = await fetch(proxyUrl, options);
      if (!response.ok) {
        console.warn(
          `Failed to fetch from ${proxyUrl}: ${response.statusText}`,
        );
        continue;
      }
      return await parseResponse(response);
    } catch (error) {
      console.warn(`Error fetching from ${proxyUrl}:`, error);
    }
  }

  return null;
};

/**
 * Load a GeoTIFF file from IndexedDB database cache or fetch it .
 *
 * @param sourceInfo object containing the URL of the GeoTIFF file.
 * @returns A promise that resolves to the file as a Blob, or undefined .
 */
export const loadGeoTiff = async (
  sourceInfo: { url?: string | undefined },
  model: IJupyterGISModel,
  file?: Contents.IModel | null,
) => {
  if (!sourceInfo?.url) {
    return null;
  }

  const url = sourceInfo.url;
  const mimeType = getMimeType(url);
  if (!mimeType || !mimeType.startsWith('image/tiff')) {
    throw new Error('Invalid file type. Expected GeoTIFF (image/tiff).');
  }

  const cachedData = await getFromIndexedDB(url);
  if (cachedData) {
    return {
      file: cachedData.file,
      metadata: cachedData.metadata,
      sourceUrl: url,
    };
  }

  let fileBlob: Blob | null = null;

  if (!file) {
    fileBlob = await fetchWithProxies(url, model, async response =>
      response.blob(),
    );
    if (!fileBlob) {
      showErrorMessage('Network error', `Failed to fetch ${url}`);
      throw new Error(`Failed to fetch ${url}`);
    }
  } else {
    fileBlob = await base64ToBlob(file.content, mimeType);
  }
};

interface IVectorEntry {
  source: Source;
  sld: string | undefined;
}

interface ITileEntry {
  gpr: GeoPackageTileRetriever;
  tileDao: object;
}

type GpkgTable = Record<string, IVectorEntry | ITileEntry>;

const geoPackageCache = new Map<string, Promise<GpkgTable>>();

/**
 * Convert curved geometries to linear geometries for a given GeoPackage vector file, and reproject the data
 *
 * @param fileBlob GeoPackage file as a blob
 * @returns Blob URL created from converted file
 */
async function linearizeReprojectGpkg(
  fileBlob:Blob,
  projection:string
): Promise<string> {
  const gdal = await getGdal();
  const file = new File([fileBlob], 'input.gpkg', { type: 'application/geopackage+sqlite3' });
  const ds = await gdal.open(file);
  await gdal.ogr2ogr(ds.datasets[0], ['-f', 'GPKG', '-nlt', 'CONVERT_TO_LINEAR', '-t_srs', projection], 'output');
  const bytes = await gdal.getFileBytes('/output/output.gpkg');
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/geopackage+sqlite3' });
  const url = URL.createObjectURL(blob);
  return url
}


function loadGeoPackageVectorFile(
  fileBlob: Blob,
  projection: string,
  cacheFilename: string,
): Promise<GpkgTable> {
  if (geoPackageCache.has(cacheFilename)) {
    return geoPackageCache.get(cacheFilename)!;
  }

  const loader = (async (): Promise<GpkgTable> => {
    try {
      const url = await linearizeReprojectGpkg(fileBlob, projection);
      const [tables, slds] = await loadGpkg(url, projection);
      const tableMap: GpkgTable = {};
      for (const name of Object.keys(tables)) {
        tableMap[name] = {
          source: tables[name] as Source,
          sld: slds[name],
        };
      }
      return tableMap;
    } catch (e: any) {
      showErrorMessage('Failed to load GeoPackage file', e);
      throw e;
    }
  })();
  geoPackageCache.set(cacheFilename, loader);
  return loader;
}

async function loadGeoPackageRasterFile(
  filepath: string,
  cacheFilename: string,
  model?: IJupyterGISModel,
  file_content?: string,
): Promise<GpkgTable> {
  if (geoPackageCache.has(cacheFilename)) {
    return geoPackageCache.get(cacheFilename)!;
  }

  const loader = (async (): Promise<GpkgTable> => {
    try {
      let bytes: Uint8Array;
      if (filepath.startsWith('http://') || filepath.startsWith('https://')) {
        bytes = await loadGkpgFromUrl(filepath, model!);
      } else {
        const arrayBuffer = await stringToArrayBuffer(file_content as string);
        bytes = new Uint8Array(arrayBuffer);
      }

      const geoPackage = await GeoPackageAPI.open(bytes);
      const tileTables = await geoPackage.getTileTables();
      const tableMap: GpkgTable = {};

      tileTables.forEach(tableName => {
        const tileDao = geoPackage.getTileDao(tableName);

        const tileWidth = tileDao.tileMatrices[0].tile_width;
        const tileHeight = tileDao.tileMatrices[0].tile_height;

        tableMap[tableName] = {
          gpr: new GeoPackageTileRetriever(tileDao, tileWidth, tileHeight),
          tileDao,
        };
      });

      return tableMap;
    } catch (error: any) {
      showErrorMessage(
        `Failed to load GeoPackage file: ${cacheFilename}`,
        error,
      );
      throw error;
    }
  })();

  geoPackageCache.set(cacheFilename, loader);
  return loader;
}

async function loadGkpgFromUrl(
  filepath: string,
  model: IJupyterGISModel,
): Promise<Uint8Array> {
  const response = await fetchWithProxies(filepath, model, async response => {
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  });
  if (!response) {
    throw new Error(`Failed to fetch GeoPackage from URL: ${filepath}`);
  }
  return response;
}

export async function getGeoPackageTableNames(
  filepath: string,
  type: 'GeoPackageVectorSource' | 'GeoPackageRasterSource',
) {
  const cacheKey = filepath + (type === 'GeoPackageRasterSource' ? 'Raster' : 'Vector');

  const tableMap = await geoPackageCache.get(cacheKey);
  if (!tableMap) {
    return [];
  }

    return Object.keys(tableMap);
}

/**
 * Generalized file reader for different source types.
 *
 * @param fileInfo - Object containing the file path and source type.
 * @returns A promise that resolves to the file content.
 */
export const loadFile = async (fileInfo: {
  filepath: string;
  type: IJGISSource['type'];
  model: IJupyterGISModel;
}) => {
  const { filepath, type, model } = fileInfo;

  if (filepath.startsWith('http://') || filepath.startsWith('https://')) {
    switch (type) {
      case 'ImageSource': {
        try {
          const response = await fetch(filepath);
          if (!response.ok) {
            throw new Error(`Failed to fetch image from URL: ${filepath}`);
          }

          const contentType = response.headers.get('Content-Type');
          if (!contentType || !contentType.startsWith('image/')) {
            throw new Error(`Invalid image URL. Content-Type: ${contentType}`);
          }

          // load the image to verify it's not corrupted
          await validateImage(await response.blob());
          return filepath;
        } catch (error) {
          console.error('Error validating remote image:', error);
          throw error;
        }
      }

      case 'ShapefileSource': {
        const cached = await getFromIndexedDB(filepath);
        if (cached) {
          return cached.file;
        }

        const geojson = await fetchWithProxies(
          filepath,
          model,
          async response => {
            const arrayBuffer = await response.arrayBuffer();
            return shp(arrayBuffer);
          },
        );

        if (geojson) {
          await saveToIndexedDB(filepath, geojson);
          return geojson;
        }

        showErrorMessage('Network error', `Failed to fetch ${filepath}`);
        throw new Error(`Failed to fetch ${filepath}`);
      }

      case 'GeoJSONSource': {
        const cached = await getFromIndexedDB(filepath);
        if (cached) {
          return cached.file;
        }

        const geojson = await fetchWithProxies(
          filepath,
          model,
          async response => response.json(),
        );

        if (geojson) {
          await saveToIndexedDB(filepath, geojson);
          return geojson;
        }

        showErrorMessage('Network error', `Failed to fetch ${filepath}`);
        throw new Error(`Failed to fetch ${filepath}`);
      }

      case 'GeoPackageVectorSource': {
        let projection = model.sharedModel.options.projection;
        if (!projection) {
          //TODO: this error should be uncommented when PR #732 is merged
          //throw new Error(`Projection is not specified for ${filepath}`);
          projection = 'EPSG:3857';
        }

        const fileBlob = await fetchWithProxies(filepath, model, async response => response.blob());

        if (!fileBlob) {
          showErrorMessage('Network error', `Failed to fetch ${filepath}`);
          throw new Error(`Failed to fetch ${filepath}`);
        }

        return loadGeoPackageVectorFile(
          fileBlob,
          projection,
          filepath + 'Vector',
        );
      }

      case 'GeoPackageRasterSource': {
        return loadGeoPackageRasterFile(filepath, filepath + 'Raster', model);
      }

      case 'GeoParquetSource': {
        const cached = await getFromIndexedDB(filepath);
        if (cached) {
          return cached.file;
        }

        const { asyncBufferFromUrl, toGeoJson } = await import('geoparquet');

        const file = await asyncBufferFromUrl({ url: filepath });
        const geojson = await toGeoJson({ file });

        if (geojson) {
          await saveToIndexedDB(filepath, geojson);
          return geojson;
        }

        showErrorMessage('Network error', `Failed to fetch ${filepath}`);
        throw new Error(`Failed to fetch ${filepath}`);
      }

      default: {
        throw new Error(`Unsupported URL handling for source type: ${type}`);
      }
    }
  }

  if (!model.contentsManager || !model.filePath) {
    throw new Error('ContentsManager or filePath is not initialized.');
  }

  const absolutePath = PathExt.resolve(
    PathExt.dirname(model.filePath),
    filepath,
  );

  try {
    const file = await model.contentsManager.get(absolutePath, {
      content: true,
    });

    if (!file.content) {
      throw new Error(`File at ${absolutePath} is empty or inaccessible.`);
    }

    switch (type) {
      case 'GeoJSONSource': {
        return typeof file.content === 'string'
          ? JSON.parse(file.content)
          : file.content;
      }

      case 'ShapefileSource': {
        const arrayBuffer = await stringToArrayBuffer(file.content as string);
        const geojson = await shp(arrayBuffer);
        return geojson;
      }

      case 'ImageSource': {
        if (typeof file.content === 'string') {
          const mimeType = getMimeType(filepath);
          if (!mimeType.startsWith('image/')) {
            throw new Error(`Invalid image file. MIME type: ${mimeType}`);
          }

          // Attempt to decode the base64 data
          try {
            await validateImage(await base64ToBlob(file.content, mimeType));
            return `data:${mimeType};base64,${file.content}`;
          } catch (error) {
            console.error('Error image content failed to decode.:', error);
            throw error;
          }
        } else {
          throw new Error('Invalid file format for image content.');
        }
      }

      case 'GeoTiffSource': {
        if (typeof file.content === 'string') {
          const tiff = loadGeoTiff({ url: filepath }, model, file);
          return tiff;
        } else {
          throw new Error('Invalid file format for tiff content.');
        }
      }

      case 'GeoPackageVectorSource': {
        let projection = model.sharedModel.options.projection;
        if (!projection) {
          //TODO: this error should be uncommented when PR #732 is merged
          //throw new Error(`Projection is not specified for ${filepath}`);
          projection = 'EPSG:3857';
        }
        const blob = await base64ToBlob(file.content, getMimeType(filepath));
        return loadGeoPackageVectorFile(blob, projection, filepath + 'Vector');
      }

      case 'GeoPackageRasterSource': {
        return loadGeoPackageRasterFile(
          filepath,
          filepath + 'Raster',
          undefined,
          file.content,
        );
      }

      case 'GeoParquetSource': {
        if (typeof file.content === 'string') {
          const { toGeoJson } = await import('geoparquet');

          const arrayBuffer = await stringToArrayBuffer(file.content as string);

          return await toGeoJson({ file: arrayBuffer, compressors });
        } else {
          throw new Error('Invalid file format for GeoParquet content.');
        }
      }

      default: {
        throw new Error(`Unsupported source type: ${type}`);
      }
    }
  } catch (error) {
    console.error(`Error reading file '${filepath}':`, error);
    throw error;
  }
};

/**
 * Validates whether a given Blob represents a valid image.
 *
 * @param blob - The Blob to validate.
 * @returns A promise that resolves if the Blob is a valid image, or rejects with an error otherwise.
 */
const validateImage = async (blob: Blob): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(); // Valid image
    img.onerror = () => reject(new Error('Invalid image content.'));
    img.src = URL.createObjectURL(blob);
  });
};

/**
 * Converts a base64-encoded string to a Blob.
 *
 * @param base64 - The base64-encoded string representing the file data.
 * @param mimeType - The MIME type of the data.
 * @returns A promise that resolves to a Blob representing the decoded data.
 */
export const base64ToBlob = async (
  base64: string,
  mimeType: string,
): Promise<Blob> => {
  const response = await fetch(`data:${mimeType};base64,${base64}`);
  return await response.blob();
};

/**
 * A mapping of file extensions to their corresponding MIME types.
 */
export const MIME_TYPES: { [ext: string]: string } = {
  // from https://github.com/python/cpython/blob/3.9/Lib/mimetypes.py
  '.a': 'application/octet-stream',
  '.ai': 'application/postscript',
  '.aif': 'audio/x-aiff',
  '.aifc': 'audio/x-aiff',
  '.aiff': 'audio/x-aiff',
  '.au': 'audio/basic',
  '.avi': 'video/x-msvideo',
  '.bat': 'text/plain',
  '.bcpio': 'application/x-bcpio',
  '.bin': 'application/octet-stream',
  '.bmp': 'image/bmp',
  '.c': 'text/plain',
  '.cdf': 'application/x-netcdf',
  '.cpio': 'application/x-cpio',
  '.csh': 'application/x-csh',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.dll': 'application/octet-stream',
  '.doc': 'application/msword',
  '.dot': 'application/msword',
  '.dvi': 'application/x-dvi',
  '.eml': 'message/rfc822',
  '.eps': 'application/postscript',
  '.etx': 'text/x-setext',
  '.exe': 'application/octet-stream',
  '.gif': 'image/gif',
  '.gpkg': 'application/geopackage+vnd.sqlite3',
  '.gtar': 'application/x-gtar',
  '.h': 'text/plain',
  '.hdf': 'application/x-hdf',
  '.htm': 'text/html',
  '.html': 'text/html',
  '.ico': 'image/vnd.microsoft.icon',
  '.ief': 'image/ief',
  '.jpe': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpg',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ksh': 'text/plain',
  '.latex': 'application/x-latex',
  '.m1v': 'video/mpeg',
  '.m3u': 'application/vnd.apple.mpegurl',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.man': 'application/x-troff-man',
  '.me': 'application/x-troff-me',
  '.mht': 'message/rfc822',
  '.mhtml': 'message/rfc822',
  '.mid': 'audio/midi',
  '.midi': 'audio/midi',
  '.mif': 'application/x-mif',
  '.mjs': 'application/javascript',
  '.mov': 'video/quicktime',
  '.movie': 'video/x-sgi-movie',
  '.mp2': 'audio/mpeg',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.mpa': 'video/mpeg',
  '.mpe': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.ms': 'application/x-troff-ms',
  '.nc': 'application/x-netcdf',
  '.nws': 'message/rfc822',
  '.o': 'application/octet-stream',
  '.obj': 'application/octet-stream',
  '.oda': 'application/oda',
  '.p12': 'application/x-pkcs12',
  '.p7c': 'application/pkcs7-mime',
  '.pbm': 'image/x-portable-bitmap',
  '.pct': 'image/pict',
  '.pdf': 'application/pdf',
  '.pfx': 'application/x-pkcs12',
  '.pgm': 'image/x-portable-graymap',
  '.pic': 'image/pict',
  '.pict': 'image/pict',
  '.pl': 'text/plain',
  '.png': 'image/png',
  '.pnm': 'image/x-portable-anymap',
  '.pot': 'application/vnd.ms-powerpoint',
  '.ppa': 'application/vnd.ms-powerpoint',
  '.ppm': 'image/x-portable-pixmap',
  '.pps': 'application/vnd.ms-powerpoint',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.ps': 'application/postscript',
  '.pwz': 'application/vnd.ms-powerpoint',
  '.py': 'text/x-python',
  '.pyc': 'application/x-python-code',
  '.pyo': 'application/x-python-code',
  '.qt': 'video/quicktime',
  '.ra': 'audio/x-pn-realaudio',
  '.ram': 'application/x-pn-realaudio',
  '.ras': 'image/x-cmu-raster',
  '.rdf': 'application/xml',
  '.rgb': 'image/x-rgb',
  '.roff': 'application/x-troff',
  '.rtf': 'application/rtf',
  '.rtx': 'text/richtext',
  '.sgm': 'text/x-sgml',
  '.sgml': 'text/x-sgml',
  '.sh': 'application/x-sh',
  '.shar': 'application/x-shar',
  '.snd': 'audio/basic',
  '.so': 'application/octet-stream',
  '.src': 'application/x-wais-source',
  '.sv4cpio': 'application/x-sv4cpio',
  '.sv4crc': 'application/x-sv4crc',
  '.svg': 'image/svg+xml',
  '.swf': 'application/x-shockwave-flash',
  '.t': 'application/x-troff',
  '.tar': 'application/x-tar',
  '.tcl': 'application/x-tcl',
  '.tex': 'application/x-tex',
  '.texi': 'application/x-texinfo',
  '.texinfo': 'application/x-texinfo',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.tr': 'application/x-troff',
  '.tsv': 'text/tab-separated-values',
  '.txt': 'text/plain',
  '.ustar': 'application/x-ustar',
  '.vcf': 'text/x-vcard',
  '.wasm': 'application/wasm',
  '.wav': 'audio/x-wav',
  '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json',
  '.wiz': 'application/msword',
  '.wsdl': 'application/xml',
  '.xbm': 'image/x-xbitmap',
  '.xlb': 'application/vnd.ms-excel',
  '.xls': 'application/vnd.ms-excel',
  '.xml': 'text/xml',
  '.xpdl': 'application/xml',
  '.xpm': 'image/x-xpixmap',
  '.xsl': 'application/xml',
  '.xul': 'text/xul',
  '.xwd': 'image/x-xwindowdump',
  '.zip': 'application/zip',
  '.ipynb': 'application/json',
};

/**
 * Determine the MIME type based on the file extension.
 *
 * @param filename - The name of the file.
 * @returns A string representing the MIME type.
 */
export const getMimeType = (filename: string): string => {
  const extension = `.${filename.split('.').pop()?.toLowerCase() || ''}`;

  if (MIME_TYPES[extension]) {
    return MIME_TYPES[extension];
  }

  console.warn(
    `Unknown file extension: ${extension}, defaulting to 'application/octet-stream'.`,
  );
  return 'application/octet-stream';
};

/**
 * Helper to convert a string (base64) to ArrayBuffer.
 *
 * @param content - File content as a base64 string.
 * @returns An ArrayBuffer.
 */
export const stringToArrayBuffer = async (
  content: string,
): Promise<ArrayBuffer> => {
  const base64Response = await fetch(
    `data:application/octet-stream;base64,${content}`,
  );
  return await base64Response.arrayBuffer();
};

const getFeatureAttributes = <T>(
  featureProperties: Record<string, Set<any>>,
  predicate: (key: string, value: any) => boolean = (key: string, value) =>
    true,
): Record<string, Set<T>> => {
  const filteredRecord: Record<string, Set<T>> = {};

  for (const [key, set] of Object.entries(featureProperties)) {
    const firstValue = set.values().next().value;
    const isValid = predicate(key, firstValue);

    if (isValid) {
      filteredRecord[key] = set;
    }
  }

  return filteredRecord;
};

/**
 * Get attributes of the feature which are numeric.
 *
 * @param featureProperties - Attributes of a feature.
 * @returns - Attributes which are numeric.
 */
export const getNumericFeatureAttributes = (
  featureProperties: Record<string, Set<any>>,
): Record<string, Set<number>> => {
  return getFeatureAttributes<number>(featureProperties, (_: string, value) => {
    return !(typeof value === 'string' && isNaN(Number(value)));
  });
};

/**
 * Get attributes of the feature which look like hex color codes.
 *
 * @param featureProperties - Attributes of a feature.
 * @returns - Attributes which look like hex color codes.
 */
export const getColorCodeFeatureAttributes = (
  featureProperties: Record<string, Set<any>>,
): Record<string, Set<string>> => {
  return getFeatureAttributes<string>(featureProperties, (_, value) => {
    const regex = new RegExp('^#[0-9a-f]{6}$');
    return typeof value === 'string' && regex.test(value);
  });
};

export function downloadFile(
  content: BlobPart,
  fileName: string,
  mimeType: string,
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = fileName;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

export async function getGeoJSONDataFromLayerSource(
  source: IJGISSource,
  model: IJupyterGISModel,
): Promise<string | null> {
  const vectorSourceTypes: SourceType[] = ['GeoJSONSource', 'ShapefileSource'];

  if (!vectorSourceTypes.includes(source.type as SourceType)) {
    console.error(
      `Invalid source type '${source.type}'. Expected one of: ${vectorSourceTypes.join(', ')}`,
    );
    return null;
  }

  if (!source.parameters) {
    console.error('Source parameters are missing.');
    return null;
  }

  if (source.parameters.path) {
    const fileContent = await loadFile({
      filepath: source.parameters.path,
      type: source.type,
      model,
    });
    return typeof fileContent === 'object'
      ? JSON.stringify(fileContent)
      : fileContent;
  } else if (source.parameters.data) {
    return JSON.stringify(source.parameters.data);
  }
  console.error("Source is missing both 'path' and 'data' parameters.");
  return null;
}

/**
 * `Object.entries`, but strongly-typed.
 *
 * `Object.entries` return value is always typed as `[string, any]` for type
 * safety reasons, which means we need to use type assertions to have typed
 * code when using it.
 */
export const objectEntries = Object.entries as <
  T extends Record<PropertyKey, unknown>,
>(
  obj: T,
) => Array<{ [K in keyof T]: [K, T[K]] }[keyof T]>;
