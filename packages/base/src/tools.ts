import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import * as d3Color from 'd3-color';

import { IJGISLayerBrowserRegistry } from '@jupytergis/schema';
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

export function focusInputField(
  filePath?: string,
  fieldId?: string | null,
  value?: any,
  color?: string,
  lastSelectedPropFieldId?: string
): string | undefined {
  const propsToRemove = ['border-color', 'box-shadow'];
  let newSelected: string | undefined;
  if (!fieldId) {
    if (lastSelectedPropFieldId) {
      removeStyleFromProperty(filePath, lastSelectedPropFieldId, propsToRemove);
      if (value) {
        const el = getElementFromProperty(filePath, lastSelectedPropFieldId);
        if (el?.tagName?.toLowerCase() === 'input') {
          (el as HTMLInputElement).value = value;
        }
      }
      newSelected = undefined;
    }
  } else {
    if (fieldId !== lastSelectedPropFieldId) {
      removeStyleFromProperty(filePath, lastSelectedPropFieldId, propsToRemove);

      const el = getElementFromProperty(filePath, fieldId);
      if (el) {
        el.style.borderColor = color ?? 'red';
        el.style.boxShadow = `inset 0 0 4px ${color ?? 'red'}`;
      }
      newSelected = fieldId;
    }
  }
  return newSelected;
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

export function removeStyleFromProperty(
  filePath: string | null | undefined,
  prop: string | null | undefined,
  properties: string[]
): void {
  if (!filePath || !prop || properties.length === 0) {
    return;
  }
  const el = getElementFromProperty(filePath, prop);
  if (el) {
    properties.forEach(prop => el.style.removeProperty(prop));
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

export function createDefaultLayerRegistry(
  layerBrowserRegistry: IJGISLayerBrowserRegistry
): void {
  const RASTER_THUMBNAILS: { [key: string]: string } = {};

  // @ts-ignore Load all images from the 'raster_thumbnails' directory
  const importAll = (r: __WebpackModuleApi.RequireContext) => {
    r.keys().forEach(key => {
      const imageName = key.replace('./', '').replace(/\.\w+$/, '');
      RASTER_THUMBNAILS[imageName] = r(key);
    });
  };

  // @ts-ignore
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
      layerBrowserRegistry.registerProvider(tile);
    } else {
      Object.keys(xyzprovider).forEach(mapName => {
        const tile = convertToRegistryEntry(
          xyzprovider[mapName]['name'],
          xyzprovider[mapName],
          entry
        );

        layerBrowserRegistry.registerProvider(tile);
      });
    }

    console.log('register', layerBrowserRegistry.getProviders());
  }

  // TODO: These need better names
  function convertToRegistryEntry(
    entry: string,
    xyzprovider: { [x: string]: any },
    provider?: string | undefined
  ) {
    return {
      name: entry,
      thumbnail: RASTER_THUMBNAILS[xyzprovider['name'].replace('.', '-')],
      source: {
        url: xyzprovider['url'],
        minZoom: xyzprovider['min_zoom'] || 0,
        maxZoom: xyzprovider['max_zoom'] || 24,
        attribution: xyzprovider['attribution'] || '',
        provider: provider ?? entry,
        time: encodeURIComponent(new Date().toISOString()),
        variant: xyzprovider['variant'] || '',
        tileMatrixSet: xyzprovider['tilematrixset'] || '',
        format: xyzprovider['format'] || ''
      }
    };
  }
}
