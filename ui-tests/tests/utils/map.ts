import type { Page } from '@playwright/test';

/**
 * Helpers to assert on the live OpenLayers map instead of comparing screenshots.
 *
 * The map is exposed on `window.jupytergisMaps`, keyed by document path, when
 * the server runs with `JGIS_EXPOSE_MAPS=1` (see `ui-tests/package.json`).
 *
 * Everything returned from `page.evaluate` must be JSON-serializable, so these
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

/**
 * Wait until the map has drawn a complete frame, meaning every source it needs
 * has finished loading. Replaces the fixed sleeps the snapshot tests relied on.
 */
export async function waitForMapReady(
  page: Page,
  filename: string,
  timeout = DEFAULT_TIMEOUT,
): Promise<string> {
  const key = await getMapKey(page, filename, timeout);
  await page.evaluate(
    async ([mapKey, limit]) => {
      const map = (window as any).jupytergisMaps[mapKey];
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Map "${mapKey}" never finished rendering`)),
          limit as number,
        );
        map.once('rendercomplete', () => {
          clearTimeout(timer);
          resolve();
        });
        map.render();
      });
    },
    [key, timeout] as [string, number],
  );
  return key;
}

/**
 * Flat list of the layers on the map, groups included, in render order.
 */
export async function getLayerSummary(
  page: Page,
  filename: string,
): Promise<ILayerSummary[]> {
  const key = await getMapKey(page, filename);
  return page.evaluate(mapKey => {
    const map = (window as any).jupytergisMaps[mapKey];
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

    for (const layer of map.getLayers().getArray()) {
      describe(layer, 0);
    }
    return summaries;
  }, key);
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
  const key = await getMapKey(page, filename);
  return page.evaluate(
    ([mapKey, id]) => {
      const map = (window as any).jupytergisMaps[mapKey];

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

      const layer = find(map.getLayers().getArray());
      if (!layer) {
        throw new Error(`No layer with id "${id}" on map "${mapKey}"`);
      }
      const style = layer.getStyle();
      return typeof style === 'function' ? 'function' : style;
    },
    [key, layerId] as [string, string],
  );
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
  const key = await getMapKey(page, filename);
  return page.evaluate(
    ([mapKey, id, attr]) => {
      const map = (window as any).jupytergisMaps[mapKey];

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

      let layer = find(map.getLayers().getArray());
      if (!layer) {
        throw new Error(`No layer with id "${id}" on map "${mapKey}"`);
      }
      // A grammar layer compiles to a LayerGroup; the styled layer is inside.
      while (layer && typeof layer.getStyleFunction !== 'function') {
        layer =
          typeof layer.getLayers === 'function'
            ? layer.getLayers().getArray()[0]
            : null;
      }
      if (!layer) {
        throw new Error(`Layer "${id}" on map "${mapKey}" carries no style`);
      }

      const styleFn = layer.getStyleFunction();
      const resolution = map.getView().getResolution();
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
    [key, layerId, attribute] as [string, string, string],
  );
}
