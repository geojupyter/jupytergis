import type { JSHandle, Locator, Page } from '@playwright/test';

/**
 * Helpers to assert on the live OpenLayers map instead of comparing screenshots.
 *
 * When the server runs with `JGIS_EXPOSE_MAPS=1` (see `ui-tests/package.json`)
 * each map is exposed two ways: on `window.jupytergisMaps` keyed by document
 * path, and on its own container element. Notebook widgets need the second one,
 * because every in-memory `GISDocument` shares one synthetic path.
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

const DEFAULT_TIMEOUT = 30000;

// ---------------------------------------------------------------------------
// Operations on a map handle, shared by the path and element lookups below
// ---------------------------------------------------------------------------

/**
 * Wait until the map has drawn a complete frame, meaning every source it needs
 * has finished loading. Replaces the fixed sleeps the snapshot tests relied on.
 */
async function waitForRender(
  map: JSHandle,
  timeout = DEFAULT_TIMEOUT,
): Promise<void> {
  await map.evaluate(async (instance: any, limit) => {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Map never finished rendering')),
        limit,
      );
      instance.once('rendercomplete', () => {
        clearTimeout(timer);
        resolve();
      });
      instance.render();
    });
  }, timeout);
}

/**
 * Flat list of the layers on the map, groups included, in render order.
 */
async function summarise(map: JSHandle): Promise<ILayerSummary[]> {
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
 * Centre and zoom of the map view, rounded so floating point noise in the
 * projection maths cannot make an assertion flaky.
 */
async function describeView(
  map: JSHandle,
): Promise<{ zoom: number; longitude: number; latitude: number }> {
  return map.evaluate((instance: any) => {
    const view = instance.getView();
    const [x, y] = view.getCenter();

    // Inverse Web Mercator, so the assertion can be written in the same
    // coordinates the notebook passes to GISDocument.
    const RADIUS = 20037508.342789244;
    const isMercator = view.getProjection().getCode() === 'EPSG:3857';
    const longitude = isMercator ? (x / RADIUS) * 180 : x;
    const latitude = isMercator
      ? (180 / Math.PI) *
        (2 * Math.atan(Math.exp(((y / RADIUS) * 180 * Math.PI) / 180)) -
          Math.PI / 2)
      : y;

    return {
      zoom: Math.round(view.getZoom() * 100) / 100,
      longitude: Math.round(longitude),
      latitude: Math.round(latitude),
    };
  });
}

// ---------------------------------------------------------------------------
// Lookup by document path, for documents opened from a file
// ---------------------------------------------------------------------------

/**
 * Resolve the `window.jupytergisMaps` key for an open document.
 *
 * Matching on the file name rather than the full path keeps the tests
 * independent of the temporary directory Galata opens the file from.
 */
export async function getMapKey(
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
  return handle.jsonValue();
}

async function mapForFile(page: Page, filename: string): Promise<JSHandle> {
  const key = await getMapKey(page, filename);
  return page.evaluateHandle(
    mapKey => (window as any).jupytergisMaps[mapKey],
    key,
  );
}

export async function waitForMapReady(
  page: Page,
  filename: string,
  timeout = DEFAULT_TIMEOUT,
): Promise<void> {
  await waitForRender(await mapForFile(page, filename), timeout);
}

export async function getLayerSummary(
  page: Page,
  filename: string,
): Promise<ILayerSummary[]> {
  return summarise(await mapForFile(page, filename));
}

/**
 * The OpenLayers flat style rules applied to a layer. Vector layers are styled
 * with plain rule objects, so this is directly assertable.
 */
export async function getLayerStyle(
  page: Page,
  filename: string,
  layerId: string,
): Promise<any> {
  const map = await mapForFile(page, filename);
  return map.evaluate((instance: any, id) => {
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

    const layer = find(instance.getLayers().getArray());
    if (!layer) {
      throw new Error(`No layer with id "${id}" on the map`);
    }
    const style = layer.getStyle();
    return typeof style === 'function' ? 'function' : style;
  }, layerId);
}

/**
 * Resolve the style OpenLayers actually computes for each feature of a vector
 * layer, at the map's current resolution. Catches symbology that is present in
 * the rules but never resolves for real data.
 */
export async function getResolvedFeatureStyles(
  page: Page,
  filename: string,
  layerId: string,
  attribute: string,
): Promise<
  Array<{ value: any; stroke?: string; fill?: string; width?: number }>
> {
  const map = await mapForFile(page, filename);
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

// ---------------------------------------------------------------------------
// Lookup by container element, for notebook widgets
// ---------------------------------------------------------------------------

async function mapInCell(cell: Locator, timeout: number): Promise<JSHandle> {
  const target = cell.locator('[data-jgis-map]').first();
  await target.waitFor({ state: 'visible', timeout });
  await cell
    .page()
    .waitForFunction(
      element => !!(element as any).jupytergisMap,
      await target.elementHandle(),
      { timeout },
    );
  return target.evaluateHandle((element: any) => element.jupytergisMap);
}

export async function waitForCellMapReady(
  cell: Locator,
  timeout = DEFAULT_TIMEOUT,
): Promise<void> {
  await waitForRender(await mapInCell(cell, timeout), timeout);
}

export async function getCellLayerSummary(
  cell: Locator,
  timeout = DEFAULT_TIMEOUT,
): Promise<ILayerSummary[]> {
  return summarise(await mapInCell(cell, timeout));
}

export async function getCellView(
  cell: Locator,
  timeout = DEFAULT_TIMEOUT,
): Promise<{ zoom: number; longitude: number; latitude: number }> {
  return describeView(await mapInCell(cell, timeout));
}
