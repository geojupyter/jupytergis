import type {
  Encoding,
  ICategoricalScale,
  IColorMapScale,
  IEncodingRule,
  IExpressionScale,
  IGrammarLayer,
  IGrammarSymbologyState,
  IScalarScale,
  RGBA,
} from '@jupytergis/schema';
import { py2vega } from 'py2vega-ts';
import {
  codegenExpression,
  constants as vegaConstants,
  functions as vegaFunctions,
  parseExpression,
} from 'vega-expression';

import {
  computeCategorizedColorStops,
  computeGraduatedColorStops,
  type SymbologyState,
} from '@/src/features/layers/symbology/styleBuilder';

/** Deck.gl RGBA. Alpha is 0–255. */
export type DeckColor = [number, number, number, number];

export type DeckColorAccessor = DeckColor | ((feature: unknown) => DeckColor);

export type DeckNumberAccessor = number | ((feature: unknown) => number);

/**
 * Deck.gl paint props compiled from grammar symbology.
 * A constant is an array or number. A data-driven scale is a function of one feature.
 * Width and radius are pixels.
 */
export interface IDeckSymbologyAccessors {
  getFillColor: DeckColorAccessor | null;
  getLineColor: DeckColorAccessor | null;
  getLineWidth: DeckNumberAccessor | null;
  getPointRadius: DeckNumberAccessor | null;
}

const EMPTY_ACCESSORS = (): IDeckSymbologyAccessors => ({
  getFillColor: null,
  getLineColor: null,
  getLineWidth: null,
  getPointRadius: null,
});

const FILL_ENCODINGS = new Set<Encoding>(['fill-color', 'circle-fill-color']);
const LINE_ENCODINGS = new Set<Encoding>([
  'stroke-color',
  'circle-stroke-color',
]);
const WIDTH_ENCODINGS = new Set<Encoding>([
  'stroke-width',
  'circle-stroke-width',
]);

const EMPTY_COLOR: DeckColor = [0, 0, 0, 0];

interface IColorStop {
  stop: number;
  color: DeckColor;
}

interface INumberStop {
  stop: number;
  output: number;
}

type VegaFn = (datum: Record<string, unknown>, global: object) => unknown;

const EMPTY_GLOBAL = Object.freeze({});
const expressionCache = new Map<string, VegaFn | null>();

/**
 * Compile grammar scales into deck.gl accessor values.
 *
 * Walks grammar layers and rules in document order. The first scale for each
 * prop wins. Guarded rules and preprocessed layers are skipped. Expression
 * scales (vega / python→vega) compile to per-feature functions via
 * vega-expression. `data` supplies attribute values for colorMap and
 * categorical classification.
 */
export function grammarToDeckAccessors(
  state: IGrammarSymbologyState | undefined,
  data?: unknown,
): IDeckSymbologyAccessors {
  const accessors = EMPTY_ACCESSORS();
  if (!state?.layers?.length) {
    return accessors;
  }

  for (const layer of state.layers) {
    if (!canPaint(layer)) {
      continue;
    }

    for (const rule of layer.rules) {
      if (rule.when?.length) {
        continue;
      }
      applyRule(rule, accessors, data);
    }
  }

  return accessors;
}

function canPaint(layer: IGrammarLayer): boolean {
  return !layer.when?.length && !layer.preprocess?.length;
}

function applyRule(
  rule: IEncodingRule,
  accessors: IDeckSymbologyAccessors,
  data: unknown,
): void {
  const field = rule.fields?.[0];

  for (const mapping of rule.mappings) {
    const { scale } = mapping;

    switch (scale.scheme) {
      case 'constant_rgba': {
        const color = toDeckColor(scale.params.value);
        for (const encoding of mapping.encodings) {
          assignColor(accessors, encoding, color);
        }
        break;
      }
      case 'constant_num': {
        const value = scale.params.value;
        if (!Number.isFinite(value)) {
          break;
        }
        for (const encoding of mapping.encodings) {
          assignNumber(accessors, encoding, value);
        }
        break;
      }
      case 'colorMap': {
        const color = colorMapAccessor(field, scale, data);
        for (const encoding of mapping.encodings) {
          assignColor(accessors, encoding, color);
        }
        break;
      }
      case 'categorical': {
        const color = categoricalAccessor(field, scale, data);
        for (const encoding of mapping.encodings) {
          assignColor(accessors, encoding, color);
        }
        break;
      }
      case 'scalar': {
        const value = scalarAccessor(field, scale);
        for (const encoding of mapping.encodings) {
          assignNumber(accessors, encoding, value);
        }
        break;
      }
      case 'identity': {
        for (const encoding of mapping.encodings) {
          if (isColorEncoding(encoding)) {
            assignColor(accessors, encoding, identityColorAccessor(field));
          } else if (isNumberEncoding(encoding)) {
            assignNumber(accessors, encoding, identityNumberAccessor(field));
          }
        }
        break;
      }
      case 'expression': {
        for (const encoding of mapping.encodings) {
          if (isColorEncoding(encoding)) {
            assignColor(accessors, encoding, expressionColorAccessor(scale));
          } else if (isNumberEncoding(encoding)) {
            assignNumber(accessors, encoding, expressionNumberAccessor(scale));
          }
        }
        break;
      }
      default:
        break;
    }
  }
}

function assignColor(
  accessors: IDeckSymbologyAccessors,
  encoding: Encoding,
  color: DeckColorAccessor,
): void {
  if (accessors.getFillColor === null && FILL_ENCODINGS.has(encoding)) {
    accessors.getFillColor = color;
  }
  if (accessors.getLineColor === null && LINE_ENCODINGS.has(encoding)) {
    accessors.getLineColor = color;
  }
}

function assignNumber(
  accessors: IDeckSymbologyAccessors,
  encoding: Encoding,
  value: DeckNumberAccessor,
): void {
  if (accessors.getLineWidth === null && WIDTH_ENCODINGS.has(encoding)) {
    accessors.getLineWidth = value;
  }
  if (accessors.getPointRadius === null && encoding === 'circle-radius') {
    accessors.getPointRadius = value;
  }
}

function isColorEncoding(encoding: Encoding): boolean {
  return FILL_ENCODINGS.has(encoding) || LINE_ENCODINGS.has(encoding);
}

function isNumberEncoding(encoding: Encoding): boolean {
  return WIDTH_ENCODINGS.has(encoding) || encoding === 'circle-radius';
}

function colorMapAccessor(
  field: string | undefined,
  scale: IColorMapScale,
  data: unknown,
): (feature: unknown) => DeckColor {
  const fallback = toDeckColor(scale.params.fallback);
  const stops = resolveColorMapStops(field, scale, data);
  if (!field || stops.length < 2) {
    return () => fallback;
  }

  return feature => {
    const value = readNumber(feature, field);
    return value === undefined ? fallback : interpolateColor(stops, value);
  };
}

function resolveColorMapStops(
  field: string | undefined,
  scale: IColorMapScale,
  data: unknown,
): IColorStop[] {
  const explicit = scale.params.colorStops;
  if (explicit && explicit.length >= 2) {
    return explicit
      .map(stop => ({ stop: stop.stop, color: toDeckColor(stop.color) }))
      .sort((a, b) => a.stop - b.stop);
  }

  if (!field) {
    return [];
  }

  const values = collectFieldValues(data, field).filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
  );
  const computed = computeGraduatedColorStops(
    {
      nClasses: scale.params.nShades,
      mode: scale.params.mode,
      colorRamp: scale.params.name,
      reverseRamp: scale.params.reverse,
      vmin: scale.params.domain?.[0],
      vmax: scale.params.domain?.[1],
    } as SymbologyState,
    values,
  );

  return computed
    .filter(
      (stop): stop is { value: number; color: RGBA } =>
        typeof stop.value === 'number',
    )
    .map(stop => ({ stop: stop.value, color: toDeckColor(stop.color) }));
}

function categoricalAccessor(
  field: string | undefined,
  scale: ICategoricalScale,
  data: unknown,
): (feature: unknown) => DeckColor {
  const fallback = toDeckColor(scale.params.fallback);
  const stops = resolveCategoricalStops(field, scale, data);
  if (!field || stops.length === 0) {
    return () => fallback;
  }

  return feature => {
    const value = readProperty(feature, field);
    if (value === null || value === undefined) {
      return fallback;
    }
    const match = stops.find(stop => stop.value === value);
    return match ? match.color : fallback;
  };
}

function resolveCategoricalStops(
  field: string | undefined,
  scale: ICategoricalScale,
  data: unknown,
): Array<{ value: string | number; color: DeckColor }> {
  const explicit = scale.params.colorStops;
  if (explicit && explicit.length > 0) {
    return explicit.map(stop => ({
      value: stop.stop,
      color: toDeckColor(stop.color),
    }));
  }

  if (!field) {
    return [];
  }

  const computed = computeCategorizedColorStops(
    {
      colorRamp: scale.params.colorRamp,
      reverseRamp: scale.params.reverse ?? false,
    } as SymbologyState,
    collectFieldValues(data, field),
  );

  return computed.flatMap(stop => {
    if (typeof stop.value !== 'string' && typeof stop.value !== 'number') {
      return [];
    }
    return [{ value: stop.value, color: toDeckColor(stop.color) }];
  });
}

function scalarAccessor(
  field: string | undefined,
  scale: IScalarScale,
): (feature: unknown) => number {
  const fallback = scale.params.fallback;
  const explicit = scale.params.scalarStops;
  const stops: INumberStop[] =
    explicit && explicit.length >= 2
      ? explicit
          .map(stop => ({ stop: stop.stop, output: stop.output }))
          .sort((a, b) => a.stop - b.stop)
      : [
          { stop: scale.params.domain[0], output: scale.params.range[0] },
          { stop: scale.params.domain[1], output: scale.params.range[1] },
        ];

  if (!field || stops.length < 2) {
    return () => fallback;
  }

  return feature => {
    const value = readNumber(feature, field);
    return value === undefined ? fallback : interpolateNumber(stops, value);
  };
}

function identityColorAccessor(
  field: string | undefined,
): (feature: unknown) => DeckColor {
  return feature => {
    if (!field) {
      return EMPTY_COLOR;
    }
    const value = readProperty(feature, field);
    return isRgba(value) ? toDeckColor(value) : EMPTY_COLOR;
  };
}

function identityNumberAccessor(
  field: string | undefined,
): (feature: unknown) => number {
  return feature => {
    if (!field) {
      return 0;
    }
    const value = readProperty(feature, field);
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  };
}

/**
 * Python expressions become Vega first (same as OL). Vega is compiled once
 * with vega-expression and run as `fn(datum)` per feature. GeoJSON features
 * expose attributes under `properties`; trip/polygon records are the datum.
 */
function expressionColorAccessor(
  scale: IExpressionScale,
): (feature: unknown) => DeckColor {
  const fallback = toDeckColor(
    isRgba(scale.params.fallback)
      ? scale.params.fallback
      : ([0, 0, 0, 0] as RGBA),
  );
  const fn = compileExpression(
    scale.params.expr,
    scale.params.language ?? 'vega',
  );

  if (!fn) {
    return () => fallback;
  }

  return feature => {
    try {
      const value = fn(datumFor(feature), EMPTY_GLOBAL);

      return isRgba(value) ? toDeckColor(value) : fallback;
    } catch {
      return fallback;
    }
  };
}

function expressionNumberAccessor(
  scale: IExpressionScale,
): (feature: unknown) => number {
  const fallback =
    typeof scale.params.fallback === 'number' &&
    Number.isFinite(scale.params.fallback)
      ? scale.params.fallback
      : 0;

  const fn = compileExpression(
    scale.params.expr,
    scale.params.language ?? 'vega',
  );

  if (!fn) {
    return () => fallback;
  }

  return feature => {
    try {
      const value = fn(datumFor(feature), EMPTY_GLOBAL);

      return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
    } catch {
      return fallback;
    }
  };
}

function compileExpression(
  expr: string,
  language: 'vega' | 'python',
): VegaFn | null {
  const trimmed = expr.trim();
  if (!trimmed) {
    return null;
  }

  const cacheKey = `${language}\0${trimmed}`;
  if (expressionCache.has(cacheKey)) {
    return expressionCache.get(cacheKey) ?? null;
  }

  try {
    const vegaExpr =
      language === 'python' ? (py2vega(trimmed) as string) : trimmed;
    const ast = parseExpression(vegaExpr);
    const generate = codegenExpression({
      constants: vegaConstants,
      functions: vegaFunctions,
      forbidden: ['window', 'document', 'globalThis', 'Function', 'eval'],
      allowed: ['datum'],
      fieldvar: 'datum',
      globalvar: 'global',
    });
    
    const { code } = generate(ast);
    const fn = new Function('datum', 'global', `return (${code});`) as VegaFn;
    expressionCache.set(cacheKey, fn);

    return fn;
  } catch {
    expressionCache.set(cacheKey, null);
    
    return null;
  }
}

function datumFor(feature: unknown): Record<string, unknown> {
  if (!feature || typeof feature !== 'object') {
    return {};
  }

  const properties = (feature as { properties?: unknown }).properties;
  if (properties && typeof properties === 'object') {
    return properties as Record<string, unknown>;
  }

  return feature as Record<string, unknown>;
}

function interpolateColor(stops: IColorStop[], value: number): DeckColor {
  if (value <= stops[0].stop) {
    return stops[0].color;
  }
  const last = stops[stops.length - 1];
  if (value >= last.stop) {
    return last.color;
  }

  for (let i = 1; i < stops.length; i++) {
    const right = stops[i];
    if (value > right.stop) {
      continue;
    }
    const left = stops[i - 1];
    const span = right.stop - left.stop;
    const t = span === 0 ? 0 : (value - left.stop) / span;
    return [
      lerp(left.color[0], right.color[0], t),
      lerp(left.color[1], right.color[1], t),
      lerp(left.color[2], right.color[2], t),
      lerp(left.color[3], right.color[3], t),
    ];
  }

  return last.color;
}

function interpolateNumber(stops: INumberStop[], value: number): number {
  if (value <= stops[0].stop) {
    return stops[0].output;
  }
  const last = stops[stops.length - 1];
  if (value >= last.stop) {
    return last.output;
  }

  for (let i = 1; i < stops.length; i++) {
    const right = stops[i];
    if (value > right.stop) {
      continue;
    }
    const left = stops[i - 1];
    const span = right.stop - left.stop;
    const t = span === 0 ? 0 : (value - left.stop) / span;
    return left.output + (right.output - left.output) * t;
  }

  return last.output;
}

function lerp(start: number, end: number, t: number): number {
  return Math.round(start + (end - start) * t);
}

/** Grammar alpha is 0–1. Deck.gl alpha is 0–255. */
function toDeckColor(
  rgba: readonly [number, number, number, number],
): DeckColor {
  const alpha = Math.round(rgba[3] * 255);
  return [rgba[0], rgba[1], rgba[2], Math.min(255, Math.max(0, alpha))];
}

function isRgba(
  value: unknown,
): value is readonly [number, number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(
      channel => typeof channel === 'number' && Number.isFinite(channel),
    )
  );
}

function collectFieldValues(data: unknown, field: string): unknown[] {
  const values: unknown[] = [];
  for (const feature of listFeatures(data)) {
    const value = readProperty(feature, field);
    if (value !== null && value !== undefined) {
      values.push(value);
    }
  }
  return values;
}

function listFeatures(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (!data || typeof data !== 'object') {
    return [];
  }

  const record = data as { type?: unknown; features?: unknown };
  if (record.type === 'FeatureCollection' && Array.isArray(record.features)) {
    return record.features;
  }
  if (record.type === 'Feature') {
    return [data];
  }
  return [];
}

function readProperty(feature: unknown, field: string): unknown {
  if (!feature || typeof feature !== 'object') {
    return undefined;
  }

  const properties = (feature as { properties?: unknown }).properties;
  if (properties && typeof properties === 'object') {
    return (properties as Record<string, unknown>)[field];
  }

  return (feature as Record<string, unknown>)[field];
}

function readNumber(feature: unknown, field: string): number | undefined {
  const value = readProperty(feature, field);
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}
