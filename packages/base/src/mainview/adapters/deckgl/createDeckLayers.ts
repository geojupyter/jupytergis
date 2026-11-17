import {
  GeoJsonLayer,
  PolygonLayer,
  type GeoJsonLayerProps,
} from '@deck.gl/layers';
import type {
  IGeoJsonLayer,
  IJGISLayer,
  IJGISSource,
  IPolygonLayer,
  IPolygonSource,
} from '@jupytergis/schema';

import {
  grammarToDeckAccessors,
  type DeckNumberAccessor,
} from './grammarToDeckAccessors';

export const DEFAULT_POLYGON_FIELD = 'polygon';

export const JSON_RECORD_SOURCES = new Set(['PolygonSource']);

export const DECK_OVERLAY_LAYER_TYPES = new Set([
  'PolygonLayer',
  'GeoJsonLayer',
]);

type LngLat = [longitude: number, latitude: number];

export type RecordGetter = (record: unknown) => unknown;

export type LogFn = (
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical',
  message: string,
) => void;

export interface IDeckLayerBuildContext {
  jsonRecords: Map<string, unknown[]>;
  geoJsonData: Map<string, unknown>;
  getSource: (id: string) => IJGISSource | undefined;
  getter: (expression: string) => RecordGetter;
  log: LogFn;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const MEMBER_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

/**
 * Reads a property path from a record.
 *
 * `name` and `name.a.b` walk the record. `param => param.a.b` walks from
 * the parameter, which stands for the record. Parentheses around the
 * parameter are optional. Anything else is rejected.
 */
export function compileGetter(expression: string): RecordGetter {
  const keys = propertyKeys(expression.trim());
  if (!keys) {
    throw new Error(`Unsupported getter "${expression.trim()}"`);
  }

  return readProperties(keys);
}

function propertyKeys(expression: string): string[] | null {
  const arrowAt = expression.indexOf('=>');
  if (arrowAt === -1) {
    return MEMBER_PATH.test(expression) ? expression.split('.') : null;
  }

  let parameter = expression.slice(0, arrowAt).trim();
  if (parameter.startsWith('(') && parameter.endsWith(')')) {
    parameter = parameter.slice(1, -1).trim();
  }

  if (!IDENTIFIER.test(parameter)) {
    return null;
  }

  const body = expression.slice(arrowAt + 2).trim();
  if (!body.startsWith(`${parameter}.`) || !MEMBER_PATH.test(body)) {
    return null;
  }

  return body.split('.').slice(1);
}

function elevationAccessor(
  elevation: DeckNumberAccessor | null,
): DeckNumberAccessor | undefined {
  if (elevation === null) {
    return undefined;
  }

  if (typeof elevation === 'number') {
    return elevation;
  }

  return feature => {
    const height = elevation(feature);
    return height;
  };
}

function geometryField(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function sourceParameters<T>(
  ctx: IDeckLayerBuildContext,
  sourceId: string | undefined,
): T | undefined {
  if (!sourceId) {
    return undefined;
  }

  return ctx.getSource(sourceId)?.parameters as T | undefined;
}

function readProperties(keys: string[]): RecordGetter {
  return record => {
    let value = record;
    for (const key of keys) {
      if (value === null || typeof value !== 'object') {
        return undefined;
      }

      value = (value as Record<string, unknown>)[key];
    }

    return value;
  };
}

export function isRing(value: unknown, minLength = 2): value is unknown[] {
  return Array.isArray(value) && value.length >= minLength;
}

export function createPolygonLayer(
  id: string,
  layer: IJGISLayer,
  ctx: IDeckLayerBuildContext,
): PolygonLayer | undefined {
  const parameters = layer.parameters as IPolygonLayer | undefined;
  const records = parameters?.source
    ? ctx.jsonRecords.get(parameters.source)
    : undefined;
  if (!records || records.length === 0) {
    return undefined;
  }

  const sourceParams = sourceParameters<IPolygonSource>(
    ctx,
    parameters?.source,
  );
  const polygonField = geometryField(
    sourceParams?.polygonField,
    DEFAULT_POLYGON_FIELD,
  );
  const getPolygon = ctx.getter(polygonField);
  const polygons = records.filter(record => isRing(getPolygon(record), 3));
  if (polygons.length === 0) {
    ctx.log(
      'warning',
      `polygon layer "${layer.name ?? id}" has no polygons for ${polygonField}.`,
    );
    return undefined;
  }

  const style = grammarToDeckAccessors(parameters?.symbologyState, polygons);
  const symbologyKey = JSON.stringify(parameters?.symbologyState ?? null);
  const getElevation = elevationAccessor(style.getElevation);

  return new PolygonLayer({
    id,
    data: polygons,
    getPolygon: record => getPolygon(record) as LngLat[],
    ...(getElevation !== undefined ? { getElevation } : {}),
    filled: parameters?.filled,
    stroked: parameters?.stroked,
    extruded: parameters?.extruded,
    ...(style.getFillColor !== null
      ? { getFillColor: style.getFillColor }
      : {}),
    ...(style.getLineColor !== null
      ? { getLineColor: style.getLineColor }
      : {}),
    ...(style.getLineWidth !== null
      ? {
          getLineWidth: style.getLineWidth,
          lineWidthUnits: 'pixels' as const,
          lineWidthMinPixels:
            typeof style.getLineWidth === 'number' ? style.getLineWidth : 0,
        }
      : {}),
    opacity: parameters?.opacity,
    visible: layer.visible ?? true,
    pickable: true,
    updateTriggers: {
      getFillColor: symbologyKey,
      getLineColor: symbologyKey,
      getLineWidth: symbologyKey,
      getElevation: symbologyKey,
      getPolygon: polygonField,
    },
  });
}

export function createGeoJsonLayer(
  id: string,
  layer: IJGISLayer,
  ctx: IDeckLayerBuildContext,
): GeoJsonLayer | undefined {
  const parameters = layer.parameters as IGeoJsonLayer | undefined;
  const data = parameters?.source
    ? ctx.geoJsonData.get(parameters.source)
    : undefined;
  if (!data) {
    return undefined;
  }

  const style = grammarToDeckAccessors(parameters?.symbologyState, data);
  const getElevation = elevationAccessor(style.getElevation);
  // deck.gl keeps attribute buffers while `data` is the same object.
  // Accessor functions are not compared, so the grammar string is the trigger.
  const symbologyKey = JSON.stringify(parameters?.symbologyState ?? null);

  return new GeoJsonLayer({
    id,
    data: data as GeoJsonLayerProps['data'],
    filled: parameters?.filled,
    stroked: parameters?.stroked,
    extruded: parameters?.extruded,
    wireframe: parameters?.wireframe,
    ...(style.getFillColor !== null
      ? { getFillColor: style.getFillColor }
      : {}),
    ...(style.getLineColor !== null
      ? { getLineColor: style.getLineColor }
      : {}),
    ...(style.getLineWidth !== null
      ? {
          getLineWidth: style.getLineWidth,
          lineWidthUnits: 'pixels' as const,
          lineWidthMinPixels:
            typeof style.getLineWidth === 'number' ? style.getLineWidth : 0,
        }
      : {}),
    ...(style.getPointRadius !== null
      ? {
          getPointRadius: style.getPointRadius,
          pointRadiusUnits: 'pixels' as const,
        }
      : {}),
    ...(getElevation !== undefined ? { getElevation } : {}),
    opacity: parameters?.opacity,
    visible: layer.visible ?? true,
    pickable: true,
    updateTriggers: {
      getFillColor: symbologyKey,
      getLineColor: symbologyKey,
      getLineWidth: symbologyKey,
      getPointRadius: symbologyKey,
      getElevation: symbologyKey,
    },
  });
}

/**
 * Build deck.gl overlay layers for the given document layer ids.
 * Only Polygon / GeoJson are produced; other types are skipped.
 */
export function buildDeckOverlayLayers(
  layerIds: string[],
  getLayer: (id: string) => IJGISLayer | undefined,
  ctx: IDeckLayerBuildContext,
): unknown[] {
  const layers: unknown[] = [];

  for (const id of layerIds) {
    const layer = getLayer(id);
    if (!layer) {
      continue;
    }

    switch (layer.type) {
      case 'PolygonLayer': {
        const created = createPolygonLayer(id, layer, ctx);
        if (created) {
          layers.push(created);
        }
        break;
      }
      case 'GeoJsonLayer': {
        const created = createGeoJsonLayer(id, layer, ctx);
        if (created) {
          layers.push(created);
        }
        break;
      }
    }
  }

  return layers;
}

export function makeCachedGetter(
  cache: Map<string, RecordGetter>,
  log: LogFn,
  prefix = 'DeckGL',
): (expression: string) => RecordGetter {
  return (expression: string) => {
    const cached = cache.get(expression);
    if (cached) {
      return cached;
    }

    let getter: RecordGetter;
    try {
      const compiled = compileGetter(expression);
      let logged = false;
      getter = record => {
        try {
          return compiled(record);
        } catch (error) {
          if (!logged) {
            logged = true;
            log('error', `${prefix}: getter "${expression}" failed: ${error}`);
          }
          return undefined;
        }
      };
    } catch (error) {
      log(
        'error',
        `${prefix}: getter "${expression}" is not a function: ${error}`,
      );
      getter = () => undefined;
    }

    cache.set(expression, getter);
    return getter;
  };
}
