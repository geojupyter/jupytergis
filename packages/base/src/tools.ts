import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import * as d3Color from 'd3-color';

import {
  IDict,
  IJGISLayerBrowserRegistry,
  IRasterLayerGalleryEntry
} from '@jupytergis/schema';
import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import RASTER_LAYER_GALLERY from '../rasterlayer_gallery/raster_layer_gallery.json';

export const debounce = (
  func: CallableFunction,
  timeout = 100
): CallableFunction => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
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
    const xyzprovider = RASTER_LAYER_GALLERY[entry];

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

export async function getSourceLayerNames(
  tileUrl: string,
  urlParameters?: IDict<string>
) {
  tileUrl = tileUrl.replace('{x}', '0').replace('{y}', '0').replace('{z}', '0');
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

  // arrayBuffer.
  //
  // const fc = arcgisPbfDecode(new Uint8Array(arrayBuffer));

  // console.log('fc', fc);
  // const pbf = new Protobuf(arrayBuffer).readFields(readData, {});

  // console.log('pbf', pbf);

  // pbf.readFields;

  const tile = new VectorTile(new Protobuf(arrayBuffer));

  // console.log('tile.layers', tile.layers);
  // console.log('tile.biome', tile.layers.Biome);
  // console.log('tile.biome feature', tile.layers.Biome.feature(1));
  // console.log('tile.biome properties', tile.layers.Biome.feature(1).properties);

  // // so for each layer i want to go through the features
  // for (const layer in tile.layers) {
  //   console.log(`Key: ${layer}, Value: ${tile.layers[layer]}`);

  //   for (let i = 0; i < tile.layers[layer].length - 1; i++) {
  //     console.log(`layer.feature(${i})`, tile.layers[layer].feature(i));
  //   }
  // }

  const layerNames = Object.keys(tile.layers);

  return layerNames;
}

// function readData(tag, data, pbf) {
//   if (tag === 1) {
//     console.log('pbf.readString()', pbf.readString());
//     data.name = pbf.readString();
//   } else if (tag === 2) {
//     console.log('pbf.readVarint()', pbf.readVarint());
//     data.version = pbf.readVarint();
//   } else if (tag === 3) {
//     data.layer = pbf.readMessage(readLayer, {});
//   }
// }
// function readLayer(tag, layer, pbf) {
//   // if (tag === 1) {
//   //   layer.name = pbf.readString();
//   // } else if (tag === 3) {
//   //   layer.size = pbf.readVarint();
//   // }

//   console.log('tag', tag);
//   console.log('layer', layer);
//   console.log('pbf', pbf);
// }
