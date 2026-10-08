import type { JSHandle, Locator, Page } from '@playwright/test';

/**
 * Helpers to assert on the live OpenLayers map instead of comparing screenshots.
 *
 * When the server runs with `JGIS_EXPOSE_MAPS=1` (see `ui-tests/package.json`)
 * every map is published on `window.jupytergisMaps` under a unique key, and its
 * container element carries that key in `data-jgis-map`. Documents opened from
 * a file are found by name, notebook widgets by their cell, but both resolve to
 * a key and from there to the same map handle.
 *
 * Everything returned from `evaluate` must be JSON-serializable, so these
 * helpers always project the OpenLayers objects down to plain values.
 */

export interface ILayerSummary {
  id?: string;
  kind: 'group' | 'vector' | 'raster' | 'unknown';
  depth: number;
  visible: boolean;
  opacity: number;
  featureCount: number | null;
  sourceState: string | null;
}

export interface ITileLoadStats {
  id?: string;
  loaded: number;
  errors: number;
}

const DEFAULT_TIMEOUT = 30000;

// ---------------------------------------------------------------------------
// Resolving a map key
// ---------------------------------------------------------------------------

/**
 * The `window.jupytergisMaps` key of a document opened from a file.
 *
 * Matching on the file name rather than the full path keeps the tests
 * independent of the temporary directory Galata opens the file from.
 */
export async function mapKeyForFile(
  page: Page,
  filename: string,
  timeout = DEFAULT_TIMEOUT,
): Promise<string> {
  const handle = await page.waitForFunction(
    name => {
      const maps = (window as any).jupytergisMaps;
      if (!maps) {
        return null;
      }
      const keys = Object.keys(maps).filter(
        key => key === name || key.endsWith(`/${name}`),
      );
      return keys.length === 1 ? keys[0] : null;
    },
    filename,
    { timeout },
  );
  const key = await handle.jsonValue();
  if (!key) {
    throw new Error(`No map registered for "${filename}"`);
  }
  return key;
}

/**
 * The `window.jupytergisMaps` key of the map rendered inside a notebook cell.
 *
 * Every in-memory `GISDocument` shares one synthetic path, so the key is read
 * off the container element rather than guessed from the document.
 */
export async function mapKeyInCell(
  cell: Locator,
  timeout = DEFAULT_TIMEOUT,
): Promise<string> {
  const target = cell.locator('[data-jgis-map]').first();
  await target.waitFor({ state: 'visible', timeout });
  const key = await target.getAttribute('data-jgis-map');
  if (!key) {
    throw new Error('The map container carries no data-jgis-map key');
  }
  return key;
}

async function mapHandle(page: Page, key: string): Promise<JSHandle> {
  return page.evaluateHandle(
    mapKey => (window as any).jupytergisMaps[mapKey],
    key,
  );
}

// ---------------------------------------------------------------------------
// Assertions on a map
// ---------------------------------------------------------------------------

/**
 * Wait until the map has drawn a complete frame. OpenLayers only reports
 * `rendercomplete` once the tile queue is empty and no source is still loading,
 * so this replaces the fixed sleeps the snapshot tests relied on.
 */
export async function waitForMapReady(
  page: Page,
  key: string,
  timeout = DEFAULT_TIMEOUT,
): Promise<void> {
  const map = await mapHandle(page, key);
  await map.evaluate(async (instance: any, limit) => {
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        instance.un('rendercomplete', done);
        reject(new Error('Map never finished rendering'));
      }, limit);
      instance.once('rendercomplete', done);
      instance.render();
    });
  }, timeout);
}

/**
 * Flat list of the layers on the map, groups included, in render order.
 */
export async function getLayerSummary(
  page: Page,
  key: string,
): Promise<ILayerSummary[]> {
  const map = await mapHandle(page, key);
  return map.evaluate((instance: any) => {
    const summaries: any[] = [];

    const describe = (layer: any, depth: number) => {
      const source = layer.getSource ? layer.getSource() : null;
      const isGroup = typeof layer.getLayers === 'function';
      const hasFeatures = !!source && typeof source.getFeatures === 'function';

      summaries.push({
        id: layer.get('id'),
        kind: isGroup
          ? 'group'
          : hasFeatures
            ? 'vector'
            : source
              ? 'raster'
              : 'unknown',
        depth,
        visible: layer.getVisible(),
        opacity: layer.getOpacity(),
        featureCount: hasFeatures ? source.getFeatures().length : null,
        // Only sources that resolve their own metadata, such as GeoTIFF and
        // GeoZarr, ever report 'error' here; a tile source that 404s does not.
        // Use `getTileLoadStats` to check that tiles actually arrived.
        sourceState:
          source && typeof source.getState === 'function'
            ? source.getState()
            : null,
      });

      if (isGroup) {
        for (const child of layer.getLayers().getArray()) {
          describe(child, depth + 1);
        }
      }
    };

    for (const layer of instance.getLayers().getArray()) {
      describe(layer, 0);
    }
    return summaries;
  });
}

/**
 * Reload every tile source on the map and report how many tiles each one
 * loaded and how many failed. This is the part of "did it render" that layer
 * state cannot answer: a tile source whose URL is broken looks perfectly ready.
 */
export async function getTileLoadStats(
  page: Page,
  key: string,
  timeout = DEFAULT_TIMEOUT,
): Promise<ITileLoadStats[]> {
  const map = await mapHandle(page, key);
  return map.evaluate(async (instance: any, limit) => {
    const stats: ITileLoadStats[] = [];

    const collect = (layer: any) => {
      if (typeof layer.getLayers === 'function') {
        layer.getLayers().getArray().forEach(collect);
        return;
      }
      const source = layer.getSource ? layer.getSource() : null;
      if (!source || typeof source.getTile !== 'function') {
        return;
      }
      const entry: ITileLoadStats = {
        id: layer.get('id'),
        loaded: 0,
        errors: 0,
      };
      stats.push(entry);
      source.on('tileloadend', () => (entry.loaded += 1));
      source.on('tileloaderror', () => (entry.errors += 1));
      source.refresh();
    };

    instance.getLayers().getArray().forEach(collect);

    await new Promise<void>(resolve => {
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      // Resolving on timeout rather than rejecting keeps the counts readable:
      // "no tile ever arrived" is a more useful failure than "timed out".
      const timer = setTimeout(() => {
        instance.un('rendercomplete', done);
        resolve();
      }, limit);
      instance.once('rendercomplete', done);
      instance.render();
    });

    return stats;
  }, timeout);
}

/**
 * Centre and zoom of the map view, in the same coordinates the Python API takes.
 */
export async function getView(
  page: Page,
  key: string,
): Promise<{ zoom: number; longitude: number; latitude: number }> {
  const map = await mapHandle(page, key);
  return map.evaluate((instance: any) => {
    const view = instance.getView();
    const [x, y] = view.getCenter();

    // Inverse Web Mercator. `ol/proj` cannot be imported into the page, and the
    // map does not expose it, so the two lines are spelled out here.
    const RADIUS = 20037508.342789244;
    const isMercator = view.getProjection().getCode() === 'EPSG:3857';
    const longitude = isMercator ? (x / RADIUS) * 180 : x;
    const latitude = isMercator
      ? (180 / Math.PI) *
        (2 * Math.atan(Math.exp((y / RADIUS) * Math.PI)) - Math.PI / 2)
      : y;

    // Three decimals is about 100 m: tight enough to catch a wrong centre,
    // loose enough to absorb the round trip through the projection.
    const round = (value: number) => Math.round(value * 1000) / 1000;
    return {
      zoom: round(view.getZoom()),
      longitude: round(longitude),
      latitude: round(latitude),
    };
  });
}

/**
 * Resolve the style OpenLayers actually computes for each feature of a vector
 * layer, at the map's current resolution. Catches symbology that is present in
 * the rules but never resolves for real data.
 */
export async function getResolvedFeatureStyles(
  page: Page,
  key: string,
  layerId: string,
  attribute: string,
): Promise<
  Array<{ value: any; stroke?: string; fill?: string; width?: number }>
> {
  const map = await mapHandle(page, key);
  return map.evaluate(
    (instance: any, [id, attr]: [string, string]) => {
      const find = (layers: any[]): any => {
        for (const layer of layers) {
          if (layer.get('id') === id) {
            return layer;
          }
          if (typeof layer.getLayers === 'function') {
            const match = find(layer.getLayers().getArray());
            if (match) {
              return match;
            }
          }
        }
        return null;
      };

      let layer = find(instance.getLayers().getArray());
      if (!layer) {
        throw new Error(`No layer with id "${id}" on the map`);
      }
      // A grammar layer compiles to a LayerGroup; the styled layer is inside.
      while (layer && typeof layer.getStyleFunction !== 'function') {
        layer =
          typeof layer.getLayers === 'function'
            ? layer.getLayers().getArray()[0]
            : null;
      }
      if (!layer) {
        throw new Error(`Layer "${id}" carries no style`);
      }

      const styleFn = layer.getStyleFunction();
      const resolution = instance.getView().getResolution();
      const asColor = (value: any) =>
        Array.isArray(value) ? `rgba(${value.join(',')})` : value;

      return layer
        .getSource()
        .getFeatures()
        .map((feature: any) => {
          const styles = styleFn(feature, resolution);
          const style = Array.isArray(styles) ? styles[0] : styles;
          const stroke = style && style.getStroke && style.getStroke();
          const fill = style && style.getFill && style.getFill();
          return {
            value: feature.get(attr),
            stroke: stroke ? asColor(stroke.getColor()) : undefined,
            width: stroke ? stroke.getWidth() : undefined,
            fill: fill ? asColor(fill.getColor()) : undefined,
          };
        });
    },
    [layerId, attribute] as [string, string],
  );
}
