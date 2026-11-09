import { TripsLayer } from '@deck.gl/geo-layers';
import {
  GeoJsonLayer,
  PolygonLayer,
  type GeoJsonLayerProps,
} from '@deck.gl/layers';
import type {
  IGeoJsonLayer,
  IJGISLayer,
  IPolygonLayer,
  ITripsLayer,
} from '@jupytergis/schema';

import {
  deckGeometryBinding,
  grammarToDeckAccessors,
  type DeckNumberAccessor,
} from './grammarToDeckAccessors';

export const DEFAULT_PATH_FIELD = 'path';
export const DEFAULT_TIMESTAMPS_FIELD = 'timestamps';
export const DEFAULT_POLYGON_FIELD = 'polygon';

export const JSON_RECORD_SOURCES = new Set(['TripsSource', 'PolygonSource']);

export const DECK_OVERLAY_LAYER_TYPES = new Set([
  'TripsLayer',
  'PolygonLayer',
  'GeoJsonLayer',
]);

type LngLat = [longitude: number, latitude: number];

export type RecordGetter = (record: unknown) => unknown;

export type TripTiming = {
  origin: number;
  from: number;
  to: number;
};

export type LogFn = (
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical',
  message: string,
) => void;

export interface IDeckLayerBuildContext {
  jsonRecords: Map<string, unknown[]>;
  geoJsonData: Map<string, unknown>;
  tripTime: number;
  getter: (expression: string) => RecordGetter;
  tripTiming: (
    sourceId: string,
    expression: string,
    records: unknown[],
    getTimestamps: RecordGetter,
  ) => TripTiming;
  log: LogFn;
}

export interface ICreatedTripsLayer {
  layer: TripsLayer;
  from: number;
  to: number;
  animationSpeed?: number;
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

/**
 * TripsLayer stores timestamps as float32. When a value would lose precision
 * we shift by an origin (earliest timestamp)
 * Same trick as the deck.gl TripsLayer docs.
 * `origin` is 0 when no shift is needed.
 *
 * @see https://deck.gl/docs/api-reference/geo-layers/trips-layer
 */
export function shiftTimestamps(timestamps: unknown, origin: number): number[] {
  if (!Array.isArray(timestamps)) {
    return [];
  }

  return timestamps.map(stamp =>
    typeof stamp === 'number' ? stamp - origin : 0,
  );
}

export function losesFloat32Precision(stamp: number): boolean {
  return Math.fround(stamp) !== stamp;
}

export function isTrip(
  path: unknown,
  timestamps: unknown,
  isRing: (value: unknown, minLength?: number) => boolean,
): boolean {
  return (
    isRing(path) &&
    Array.isArray(timestamps) &&
    timestamps.length === (path as unknown[]).length &&
    timestamps.every(
      stamp => typeof stamp === 'number' && Number.isFinite(stamp),
    )
  );
}

export function isRing(value: unknown, minLength = 2): value is unknown[] {
  return Array.isArray(value) && value.length >= minLength;
}

export function createTripsLayer(
  id: string,
  layer: IJGISLayer,
  ctx: IDeckLayerBuildContext,
): ICreatedTripsLayer | null {
  const parameters = layer.parameters as ITripsLayer | undefined;
  const records = parameters?.source
    ? ctx.jsonRecords.get(parameters.source)
    : undefined;

  if (!records || records.length === 0) {
    return null;
  }

  const geometry = deckGeometryBinding(parameters?.symbologyState);
  const pathField = geometryField(geometry.path, DEFAULT_PATH_FIELD);
  const stampField = geometryField(
    geometry.timestamps,
    DEFAULT_TIMESTAMPS_FIELD,
  );
  const getPath = ctx.getter(pathField);
  const getTimestamps = ctx.getter(stampField);
  const trips = records.filter(record =>
    isTrip(getPath(record), getTimestamps(record), isRing),
  );

  if (trips.length === 0) {
    ctx.log(
      'warning',
      `trips layer "${layer.name ?? id}" has no trips for ${pathField}.`,
    );

    return null;
  }

  const timing = ctx.tripTiming(
    parameters?.source ?? id,
    stampField,
    records,
    getTimestamps,
  );

  const style = grammarToDeckAccessors(parameters?.symbologyState, trips);
  const symbologyKey = JSON.stringify(parameters?.symbologyState ?? null);
  const trailColor = style.getFillColor ?? style.getLineColor;
  const trailWidth = style.getLineWidth ?? style.getPointRadius;

  const end = parameters?.loopLength ?? timing.to + timing.origin;

  return {
    from: timing.from,
    to: end - timing.origin,
    animationSpeed: parameters?.animationSpeed,
    layer: new TripsLayer({
      id,
      data: trips,
      getPath: record => getPath(record) as LngLat[],
      getTimestamps: record =>
        shiftTimestamps(getTimestamps(record), timing.origin),
      ...(trailColor !== null ? { getColor: trailColor } : {}),
      currentTime: ctx.tripTime,
      trailLength: parameters?.trailLength,
      fadeTrail: parameters?.fadeTrail,
      ...(trailWidth !== null
        ? {
            getWidth: trailWidth,
            widthUnits: 'pixels' as const,
            widthMinPixels: typeof trailWidth === 'number' ? trailWidth : 0,
          }
        : { widthMinPixels: parameters?.widthMinPixels }),
      capRounded: parameters?.capRounded,
      jointRounded: parameters?.jointRounded,
      opacity: parameters?.opacity,
      visible: layer.visible ?? true,
      updateTriggers: {
        getColor: symbologyKey,
        getWidth: symbologyKey,
      },
    }),
  };
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

  const geometry = deckGeometryBinding(parameters?.symbologyState);
  const polygonField = geometryField(geometry.polygon, DEFAULT_POLYGON_FIELD);
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
    getFillColor: style.getFillColor ?? parameters?.fillColor,
    getLineColor: style.getLineColor ?? parameters?.lineColor,
    ...(style.getLineWidth !== null
      ? {
          getLineWidth: style.getLineWidth,
          lineWidthUnits: 'pixels' as const,
          lineWidthMinPixels:
            typeof style.getLineWidth === 'number' ? style.getLineWidth : 0,
        }
      : {
          lineWidthUnits: 'pixels' as const,
          lineWidthMinPixels: parameters?.lineWidthMinPixels,
        }),
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

export type TripPlayback = {
  from: number;
  to: number;
  animationSpeed: number;
};

/**
 * Build deck.gl overlay layers for the given document layer ids.
 * Only Trips / Polygon / GeoJson are produced; other types are skipped.
 */
export function buildDeckOverlayLayers(
  layerIds: string[],
  getLayer: (id: string) => IJGISLayer | undefined,
  ctx: IDeckLayerBuildContext,
): { layers: unknown[]; tripPlayback: TripPlayback | null } {
  const layers: unknown[] = [];
  let tripPlayback: TripPlayback | null = null;

  for (const id of layerIds) {
    const layer = getLayer(id);
    if (!layer) {
      continue;
    }

    switch (layer.type) {
      case 'TripsLayer': {
        const created = createTripsLayer(id, layer, ctx);
        if (!created) {
          continue;
        }

        layers.push(created.layer);
        if (!tripPlayback && created.animationSpeed) {
          tripPlayback = {
            from: created.from,
            to: created.to,
            animationSpeed: created.animationSpeed,
          };
        }
        break;
      }
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

  return { layers, tripPlayback };
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

export function computeTripTiming(
  cache: Map<string, TripTiming>,
  sourceId: string,
  expression: string,
  records: unknown[],
  getTimestamps: RecordGetter,
): TripTiming {
  const key = `${sourceId}\0${expression}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;
  let needsShift = false;
  for (const record of records) {
    const stamps = getTimestamps(record);
    if (!Array.isArray(stamps)) {
      continue;
    }

    for (const stamp of stamps) {
      if (typeof stamp !== 'number' || !Number.isFinite(stamp)) {
        continue;
      }
      earliest = Math.min(earliest, stamp);
      latest = Math.max(latest, stamp);

      if (!needsShift && losesFloat32Precision(stamp)) {
        needsShift = true;
      }
    }
  }

  const timing = Number.isFinite(earliest)
    ? needsShift
      ? { origin: earliest, from: 0, to: latest - earliest }
      : { origin: 0, from: earliest, to: latest }
    : { origin: 0, from: 0, to: 0 };
  cache.set(key, timing);

  return timing;
}

export function clearTripTimingForSource(
  cache: Map<string, TripTiming>,
  sourceId: string,
): void {
  const prefix = `${sourceId}\0`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}
