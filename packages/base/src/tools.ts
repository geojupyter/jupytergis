import {
  IDict,
  IJGISLayerBrowserRegistry,
  IJGISOptions,
  IJGISSource,
  IJupyterGISModel,
  ILayerGalleryEntry,
  SourceType,
} from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { PathExt, URLExt } from '@jupyterlab/coreutils';
import { Contents, ServerConnection } from '@jupyterlab/services';
import { VectorTile } from '@mapbox/vector-tile';
import { compressors } from 'hyparquet-compressors';
import Protobuf from 'pbf';
import shp from 'shpjs';

import LAYER_GALLERY from '@/layer_gallery.json';

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

/** Read a CSS variable from the document root and return the value. */
export function getCssVarAsColor(cssVar: string): string {
  if (typeof document === 'undefined') {
    return '';
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar)
    .trim();
  if (!value) {
    return '';
  }

  return value;
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
      console.error(
        'Jupyter API request failed -- not a JSON response body:',
        response,
      );
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
  const LAYER_THUMBNAILS: { [key: string]: string } = {};

  /**
   * Generate object to hold thumbnail URLs
   */
  const importAll = (r: __WebpackModuleApi.RequireContext) => {
    r.keys().forEach(key => {
      const imageName = key.replace('./', '').replace(/\.\w+$/, '');
      LAYER_THUMBNAILS[imageName] = r(key);
    });
  };

  const context = require.context(
    '../layer_gallery',
    false,
    /\.(png|jpe?g|gif|svg)$/,
  );
  importAll(context);

  for (const entry of Object.keys(LAYER_GALLERY)) {
    const layerProvider: any = (LAYER_GALLERY as any)[entry];

    if ('thumbnailPath' in layerProvider) {
      /*flat layer provider*/
      const tile = convertToRegistryEntry(entry, layerProvider);
      layerBrowserRegistry.addRegistryLayer(tile);
    } else {
      /* nested layer provider */
      Object.keys(layerProvider).forEach(mapName => {
        const tile = convertToRegistryEntry(
          layerProvider[mapName]['name'],
          layerProvider[mapName],
          entry,
        );

        layerBrowserRegistry.addRegistryLayer(tile);
      });
    }
  }

  // TODO: These need better names
  /**
   * Parse tile information from providers to be usable in the layer registry
   *
   * @param entry - The name of the entry, which may also serve as the default provider name if none is specified.
   * @param layerProvider - An object containing the provider's details, including name, URL, zoom levels, attribution, and possibly other properties relevant to the provider.
   * @param provider - Optional. Specifies the provider name. If not provided, the `entry` parameter is used as the default provider name.
   * @returns - An object representing the registry entry
   */
  function convertToRegistryEntry(
    entry: string,
    layerProvider: { [x: string]: any },
    provider?: string | undefined,
  ): ILayerGalleryEntry {
    return {
      name: entry,
      thumbnail: LAYER_THUMBNAILS[layerProvider['name'].replace('.', '-')],
      sourceType: layerProvider['sourceType'],
      layerType: layerProvider['layerType'],
      sourceParameters: layerProvider['sourceParameters'],
      layerParameters: layerProvider['layerParameters'],
      provider: provider ?? entry.split('.', 1)[0],
      description: layerProvider['description'],
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

  return {
    file: fileBlob,
    sourceUrl: url,
  };
};

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
        switch (file.format) {
          case 'base64': {
            return JSON.parse(atob(file.content));
          }
          case 'text': {
            return JSON.parse(file.content);
          }
          case 'json': {
            return file.content;
          }
        }
        break;
      }

      case 'ShapefileSource': {
        let buffer: ArrayBuffer;
        switch (file.format) {
          case 'base64': {
            buffer = await base64ToArrayBuffer(file.content);
            break;
          }
          case 'text': {
            buffer = await stringToArrayBuffer(file.content);
            break;
          }
          case 'json':
          default: {
            throw new Error(`Invalid Shapefile format: ${file.format}.`);
          }
        }
        const geojson = await shp(buffer);
        return geojson;
      }

      case 'ImageSource': {
        if (file.format === 'base64') {
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

      case 'GeoParquetSource': {
        let buffer: ArrayBuffer;
        switch (file.format) {
          case 'base64': {
            buffer = await base64ToArrayBuffer(file.content);
            break;
          }
          case 'text': {
            buffer = await stringToArrayBuffer(file.content);
            break;
          }
          case 'json':
          default: {
            throw new Error(`Invalid Geoparquet format: ${file.format}.`);
          }
        }

        const { toGeoJson } = await import('geoparquet');

        return await toGeoJson({ file: buffer, compressors });
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
const base64ToArrayBuffer = async (content: string): Promise<ArrayBuffer> => {
  const base64Response = await fetch(
    `data:application/octet-stream;base64,${content}`,
  );
  return await base64Response.arrayBuffer();
};

/**
 * Helper to convert a raw string to ArrayBuffer.
 *
 * @param content - Raw string content.
 * @returns An ArrayBuffer.
 */
const stringToArrayBuffer = async (content: string): Promise<ArrayBuffer> => {
  return new TextEncoder().encode(content).buffer;
};

export const getFeatureAttributes = <T>(
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

  if (!vectorSourceTypes.includes(source.type)) {
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
