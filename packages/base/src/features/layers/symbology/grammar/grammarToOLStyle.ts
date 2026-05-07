/**
 * Grammar → OL FlatStyle compiler.
 *
 * grammarToOLStyle(state) compiles an IGrammarSymbologyState into an OL
 * FlatStyle object ready to be applied to a VectorLayer or VectorTileLayer.
 *
 * Compilation steps:
 *   1. Expand rules into per-channel entries (guard + expression).
 *   2. Build a case expression per channel (conditional entries first,
 *      last unconditional entry as the else branch).
 *   3. Assemble sub-channels (fill-red/green/blue/alpha) into a composite
 *      fill-color ['array', r, g, b, a] expression.
 */

import { ExpressionValue } from 'ol/expr/expression';

import {
  computeCategorizedColorStops,
  computeGraduatedColorStops,
  SymbologyState,
} from '../styleBuilder';
import {
  ICategoricalScale,
  IColorRampScale,
  IMapping,
  IScalarScale,
  IGrammarSymbologyState,
  IPredicate,
  OLStyleChannel,
  RGBA,
  UInt8Channel,
  UNormChannel,
} from './types';

// '$density' is the pseudo-field produced by a kde transform (KDE density raster).
// Encoding rules referencing it are compiled only when a kde transform is present;
// the actual OL HeatmapLayer instantiation happens outside this compiler.
export const DENSITY_FIELD = '$density';

// ---------------------------------------------------------------------------
// Field expression helpers
// ---------------------------------------------------------------------------

/**
 * Convert a field name to an OL expression.
 * $band-N (raster pseudo-fields) → ['band', N]
 * everything else → ['get', field]
 */
function fieldExpr(field: string): ExpressionValue {
  const m = field.match(/^\$band-(\d+)$/);
  if (m) {
    return ['band', parseInt(m[1], 10)] as ExpressionValue;
  }
  return ['get', field];
}

/** Band pseudo-fields always exist; vector feature properties may not. */
function fieldAlwaysPresent(field: string): boolean {
  return /^\$band-\d+$/.test(field) || field === DENSITY_FIELD;
}

// ---------------------------------------------------------------------------
// Types used internally during compilation
// ---------------------------------------------------------------------------

interface IChannelEntry {
  guard?: ExpressionValue; // undefined = unconditional
  expr: ExpressionValue;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile a Grammar symbology state to an OL FlatStyle object.
 * Sub-channels (fill-red/green/blue/alpha) are assembled into fill-color.
 *
 * @param featureValues  Feature attribute values for the rule field(s).
 *   Required for categorical and colorRamp scales so the compiler can
 *   enumerate unique values / compute classification breaks at render time,
 *   mirroring how buildVectorFlatStyle works.
 */
export function grammarToOLStyle(
  state: IGrammarSymbologyState,
  featureValues: unknown[] = [],
): Record<string, ExpressionValue> {
  // Accumulate per-channel entries from all layers and their rules.
  // Layers with a kde/cluster preprocess are handled at the renderer level;
  // this compiler only produces the flat-style for the vector portion.
  const accumulator = new Map<OLStyleChannel, IChannelEntry[]>();

  for (const layer of state.layers) {
    if (layer.preprocess?.some(t => t.type === 'kde')) {
      // KDE layers are compiled separately by the renderer (HeatmapLayer).
      // Skip flat-style compilation for this layer.
      continue;
    }

    for (const rule of layer.rules) {
      // For now use the first field; multi-field assembly is handled via
      // sub-channel mappings (pixel-red/green/blue) or expression scales.
      const field = rule.fields?.[0];
      const guard =
        rule.when && rule.when.length > 0 ? compileGuard(rule.when) : undefined;

      for (const mapping of rule.mappings) {
        for (const channel of mapping.channels) {
          if (channel === 'pixel-rgb') {
            // Virtual channel: fan out to pixel-red/green/blue so assembleStyle
            // can compose them into ['color', r, g, b, a] with a separate alpha.
            for (const sub of [
              'pixel-red',
              'pixel-green',
              'pixel-blue',
            ] as OLStyleChannel[]) {
              const expr = compileMapping(field, mapping, featureValues, sub);
              const entries = accumulator.get(sub) ?? [];
              entries.push({ guard, expr });
              accumulator.set(sub, entries);
            }
          } else {
            // Compile per-channel so sub-channels (pixel-red/green/blue) can each
            // extract the correct component from a colorRamp or other color scale.
            const expr = compileMapping(field, mapping, featureValues, channel);
            const entries = accumulator.get(channel) ?? [];
            entries.push({ guard, expr });
            accumulator.set(channel, entries);
          }
        }
      }
    }
  }

  // Build per-channel OL expressions.
  const channelExprs = new Map<OLStyleChannel, ExpressionValue>();
  for (const [channel, entries] of accumulator) {
    channelExprs.set(channel, buildChannelExpr(entries, channel));
  }

  // Assemble into the final style object, handling sub-channel composition.
  return assembleStyle(channelExprs);
}

// ---------------------------------------------------------------------------
// Channel expression builder
// ---------------------------------------------------------------------------

/**
 * Merge a list of ChannelEntries into a single OL expression.
 * Conditional entries form case branches; the last unconditional entry wins
 * as the else branch (transparent/zero if none).
 */
function buildChannelExpr(
  entries: IChannelEntry[],
  channel: OLStyleChannel,
): ExpressionValue {
  const conditional = entries.filter(e => e.guard !== undefined);
  const unconditional = entries.filter(e => e.guard === undefined);

  const elseExpr: ExpressionValue =
    unconditional.length > 0
      ? unconditional[unconditional.length - 1].expr
      : channelZero(channel);

  if (conditional.length === 0) {
    return elseExpr;
  }

  const caseExpr: ExpressionValue[] = ['case'];
  for (const { guard, expr } of conditional) {
    caseExpr.push(guard as ExpressionValue, expr);
  }
  caseExpr.push(elseExpr);
  return caseExpr;
}

/** Typed zero for channels with no unconditional rule. */
function channelZero(channel: OLStyleChannel): ExpressionValue {
  const rgbaChannels = new Set<OLStyleChannel>([
    'fill-color',
    'stroke-color',
    'circle-fill-color',
    'circle-stroke-color',
    'pixel-color',
  ]);
  return rgbaChannels.has(channel) ? 'rgba(0,0,0,0)' : 0;
}

// ---------------------------------------------------------------------------
// Sub-channel assembly
// ---------------------------------------------------------------------------

const FILL_SUB: UInt8Channel[] = ['fill-red', 'fill-green', 'fill-blue'];
const FILL_ALPHA_SUB: UNormChannel[] = ['fill-alpha'];
const PIXEL_SUB: UInt8Channel[] = ['pixel-red', 'pixel-green', 'pixel-blue'];
const PIXEL_ALPHA_SUB: UNormChannel[] = ['pixel-alpha'];

/**
 * Assemble the final style object.
 * Sub-channels (fill-red/green/blue/alpha, pixel-red/green/blue/alpha) are
 * combined into a ['color', r, g, b, a] expression on the parent channel.
 * Virtual channels (pixel-rgb) are already fanned out before this runs.
 */
function assembleStyle(
  channelExprs: Map<OLStyleChannel, ExpressionValue>,
): Record<string, ExpressionValue> {
  const style: Record<string, ExpressionValue> = {};

  // Collect named channels directly.
  const skip = new Set<OLStyleChannel>([
    ...FILL_SUB,
    ...FILL_ALPHA_SUB,
    ...PIXEL_SUB,
    ...PIXEL_ALPHA_SUB,
  ]);

  for (const [channel, expr] of channelExprs) {
    if (!skip.has(channel)) {
      style[channel] = expr;
    }
  }

  // Assemble fill-color from sub-channels if any fill-* sub-channel is present.
  // ['color', r, g, b, a] is the OL operator that produces ColorType (r/g/b 0-255, a 0-1).
  if (
    FILL_SUB.some(c => channelExprs.has(c)) ||
    FILL_ALPHA_SUB.some(c => channelExprs.has(c))
  ) {
    const r = channelExprs.get('fill-red') ?? 0;
    const g = channelExprs.get('fill-green') ?? 0;
    const b = channelExprs.get('fill-blue') ?? 0;
    const a = channelExprs.get('fill-alpha') ?? 1;
    style['fill-color'] = ['color', r, g, b, a] as ExpressionValue;
  }

  // Assemble pixel-color from sub-channels when pixel-R/G/B are present.
  // pixel-alpha alone does NOT overwrite a direct pixel-color mapping.
  if (PIXEL_SUB.some(c => channelExprs.has(c))) {
    const r = channelExprs.get('pixel-red') ?? 0;
    const g = channelExprs.get('pixel-green') ?? 0;
    const b = channelExprs.get('pixel-blue') ?? 0;
    const a = channelExprs.get('pixel-alpha') ?? 1;
    style['pixel-color'] = ['color', r, g, b, a] as ExpressionValue;
  } else if (
    PIXEL_ALPHA_SUB.some(c => channelExprs.has(c)) &&
    !channelExprs.has('pixel-color')
  ) {
    // Alpha-only with no direct pixel-color: compose with black.
    const a = channelExprs.get('pixel-alpha') ?? 1;
    style['pixel-color'] = ['color', 0, 0, 0, a] as ExpressionValue;
  }

  return style;
}

// ---------------------------------------------------------------------------
// Guard compilation
// ---------------------------------------------------------------------------

function compileGuard(predicates: IPredicate[]): ExpressionValue {
  const conditions = predicates.map(compilePredicate);
  return conditions.length === 1 ? conditions[0] : ['all', ...conditions];
}

function compilePredicate(predicate: IPredicate): ExpressionValue {
  switch (predicate.type) {
    case 'geometryType':
      return ['==', ['geometry-type'], predicate.value];
    case 'hasField':
      return ['has', predicate.field];
    case 'fieldEquals':
      return ['==', ['get', predicate.field], predicate.value];
  }
}

// ---------------------------------------------------------------------------
// Mapping compilation — dispatches by scale scheme
// ---------------------------------------------------------------------------

/**
 * Return the RGBA array index for a sub-channel, or undefined for full-color
 * channels.  Used to decompose a colorRamp into a single numeric component.
 */
function colorComponentIndex(channel: OLStyleChannel): number | undefined {
  switch (channel) {
    case 'fill-red':
    case 'pixel-red':
      return 0;
    case 'fill-green':
    case 'pixel-green':
      return 1;
    case 'fill-blue':
    case 'pixel-blue':
      return 2;
    case 'fill-alpha':
    case 'pixel-alpha':
      return 3;
    default:
      return undefined;
  }
}

function compileMapping(
  field: string | undefined,
  mapping: IMapping,
  featureValues: unknown[],
  channel: OLStyleChannel,
): ExpressionValue {
  const { scale } = mapping;
  switch (scale.scheme) {
    case 'colorRamp':
      return field
        ? compileColorRamp(field, scale, featureValues, channel)
        : scale.params.fallback;
    case 'categorical':
      return field
        ? compileCategorical(field, scale, featureValues)
        : scale.params.fallback;
    case 'expression':
      // Expression scale is not yet implemented; fall back to channel zero.
      console.warn(
        '[grammarToOLStyle] expression scale is not yet implemented',
      );
      return channelZero(mapping.channels[0]);
    case 'constant_rgba':
    case 'constant_num':
      return scale.params.value as ExpressionValue;
    case 'scalar':
      return field ? compileScalar(field, scale) : scale.params.fallback;
    case 'identity': {
      if (!field) {
        return channelZero(mapping.channels[0]);
      }
      // Wrap with coalesce so OL's expression type system infers the correct
      // output type (color vs number). Bare ['get', field] has type 'any'
      // which OL rejects for typed channels like fill-color.
      const isColorChannel = (mapping.channels as string[]).some(ch =>
        [
          'fill-color',
          'stroke-color',
          'circle-fill-color',
          'circle-stroke-color',
          'pixel-color',
        ].includes(ch),
      );
      const typedFallback: ExpressionValue = isColorChannel
        ? ([0, 0, 0, 0] as ExpressionValue)
        : 0;
      if (fieldAlwaysPresent(field)) {
        return fieldExpr(field);
      }
      return ['coalesce', fieldExpr(field), typedFallback] as ExpressionValue;
    }
  }
}

// ---------------------------------------------------------------------------
// Scale compilers
// ---------------------------------------------------------------------------

/**
 * colorRamp: numeric field → RGBA color via a named palette + classification.
 *
 * Output:
 *   ['case', ['has', field],
 *     ['interpolate', ['linear'], ['get', field], stop0, color0, ...],
 *     fallback]
 */
function compileColorRamp(
  field: string,
  scale: IColorRampScale,
  featureValues: unknown[],
  channel?: OLStyleChannel,
): ExpressionValue {
  const stops = resolveColorStops(scale, featureValues);

  // Guard: interpolate requires at least 2 stop pairs. Return fallback when
  // the source is not yet loaded and no explicit domain/colorStops are set.
  if (stops.length < 2) {
    const componentIdx =
      channel !== undefined ? colorComponentIndex(channel) : undefined;
    return componentIdx !== undefined ? 0 : scale.params.fallback;
  }

  const componentIdx =
    channel !== undefined ? colorComponentIndex(channel) : undefined;

  const interpolateExpr: ExpressionValue[] = [
    'interpolate',
    ['linear'],
    fieldExpr(field),
  ];

  if (componentIdx !== undefined) {
    // Sub-channel scalar interpolation for one color component (R=0,G=1,B=2,A=3).
    // colormap stops carry [r, g, b, a] with r/g/b in 0-255 and a in 0-1.
    // Values are passed as-is since assembleStyle uses ['color', r, g, b, a]
    // which takes r/g/b in 0-255.
    for (const { stop, color } of stops) {
      interpolateExpr.push(stop, (color as number[])[componentIdx]);
    }
    if (fieldAlwaysPresent(field)) {
      return interpolateExpr;
    }
    return ['case', ['has', field], interpolateExpr, 0];
  }

  // Full color channel: emit the usual RGBA interpolation.
  for (const { stop, color } of stops) {
    interpolateExpr.push(stop, color as ExpressionValue);
  }
  if (fieldAlwaysPresent(field)) {
    return interpolateExpr;
  }
  return ['case', ['has', field], interpolateExpr, scale.params.fallback];
}

/**
 * Resolve color stops for a colorRamp scale.
 * Explicit colorStops (user overrides) take precedence; otherwise classification
 * breaks are computed from featureValues using computeGraduatedColorStops.
 */
function resolveColorStops(
  scale: IColorRampScale,
  featureValues: unknown[],
): Array<{ stop: number; color: RGBA }> {
  if (scale.params.colorStops && scale.params.colorStops.length >= 2) {
    return scale.params.colorStops;
  }

  const numericValues = featureValues.filter(Number.isFinite) as number[];
  const syntheticState = {
    nClasses: scale.params.nShades,
    mode: scale.params.mode,
    colorRamp: scale.params.name,
    reverseRamp: scale.params.reverse,
    vmin: scale.params.domain?.[0],
    vmax: scale.params.domain?.[1],
  } as unknown as SymbologyState;

  const computed = computeGraduatedColorStops(syntheticState, numericValues);
  return computed.map(s => ({
    stop: s.value as number,
    color: s.color as RGBA,
  }));
}

/**
 * categorical: nominal field → RGBA color via a named palette.
 * Unique field values are enumerated from featureValues at render time,
 * mirroring buildCategorized.
 *
 * Output:
 *   ['case',
 *     ['==', ['get', field], val0], color0,
 *     ...,
 *     fallback]
 */
function compileCategorical(
  field: string,
  scale: ICategoricalScale,
  featureValues: unknown[],
): ExpressionValue {
  let stops: Array<{ value: unknown; color: unknown }>;

  if (scale.params.colorStops && scale.params.colorStops.length > 0) {
    stops = scale.params.colorStops.map(s => ({
      value: s.stop,
      color: s.color,
    }));
  } else {
    const syntheticState = {
      colorRamp: scale.params.colorRamp,
      reverseRamp: scale.params.reverse ?? false,
    } as unknown as SymbologyState;
    stops = computeCategorizedColorStops(syntheticState, featureValues);
  }

  // Guard: a OL case expression requires at least one condition+value pair
  // before the else branch. Return fallback directly when stops is empty.
  if (stops.length === 0) {
    return scale.params.fallback;
  }

  const caseExpr: ExpressionValue[] = ['case'];
  for (const stop of stops) {
    caseExpr.push(
      ['==', fieldExpr(field), stop.value as ExpressionValue],
      stop.color as ExpressionValue,
    );
  }
  caseExpr.push(scale.params.fallback);
  return caseExpr;
}

/**
 * scalar: numeric field → numeric output (radius, width, sub-channel value).
 *
 * Output:
 *   ['case', ['has', field],
 *     ['interpolate', ['linear'], ['get', field], stop0, out0, ...],
 *     fallback]
 */
function compileScalar(field: string, scale: IScalarScale): ExpressionValue {
  const interpolateExpr: ExpressionValue[] = [
    'interpolate',
    ['linear'],
    fieldExpr(field),
  ];

  if (scale.params.scalarStops && scale.params.scalarStops.length >= 2) {
    for (const { stop, output } of scale.params.scalarStops) {
      interpolateExpr.push(stop, output);
    }
  } else {
    interpolateExpr.push(
      scale.params.domain[0],
      scale.params.range[0],
      scale.params.domain[1],
      scale.params.range[1],
    );
  }

  if (fieldAlwaysPresent(field)) {
    return interpolateExpr;
  }
  return ['case', ['has', field], interpolateExpr, scale.params.fallback];
}
