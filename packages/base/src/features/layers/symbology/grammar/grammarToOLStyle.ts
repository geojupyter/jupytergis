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

import colormap from 'colormap';
import { ExpressionValue } from 'ol/expr/expression';

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

// ---------------------------------------------------------------------------
// Types used internally during compilation
// ---------------------------------------------------------------------------

interface ChannelEntry {
  guard?: ExpressionValue; // undefined = unconditional
  expr: ExpressionValue;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile a Grammar symbology state to an OL FlatStyle object.
 * Sub-channels (fill-red/green/blue/alpha) are assembled into fill-color.
 */
export function grammarToOLStyle(
  state: IGrammarSymbologyState,
): Record<string, ExpressionValue> {
  // Accumulate per-channel entries from all rules.
  const accumulator = new Map<OLStyleChannel, ChannelEntry[]>();

  for (const rule of state.rules) {
    const guard =
      rule.when && rule.when.length > 0
        ? compileGuard(rule.when)
        : undefined;

    for (const mapping of rule.mappings) {
      const expr = compileMapping(rule.field, mapping);
      for (const channel of mapping.channels) {
        const entries = accumulator.get(channel) ?? [];
        entries.push({ guard, expr });
        accumulator.set(channel, entries);
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
  entries: ChannelEntry[],
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
    caseExpr.push(guard!, expr);
  }
  caseExpr.push(elseExpr);
  return caseExpr;
}

/** Typed zero for channels with no unconditional rule. */
function channelZero(channel: OLStyleChannel): ExpressionValue {
  const rgbaChannels = new Set<OLStyleChannel>([
    'fill-color', 'stroke-color', 'circle-fill-color', 'circle-stroke-color', 'pixel-color',
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
 * Sub-channels (fill-red/green/blue/alpha, pixel-*) are combined into a single
 * ['array', r, g, b, a] expression on the parent channel (fill-color / pixel-color).
 */
function assembleStyle(
  channelExprs: Map<OLStyleChannel, ExpressionValue>,
): Record<string, ExpressionValue> {
  const style: Record<string, ExpressionValue> = {};

  // Collect named channels directly.
  const skip = new Set<OLStyleChannel>([
    ...FILL_SUB, ...FILL_ALPHA_SUB, ...PIXEL_SUB, ...PIXEL_ALPHA_SUB,
  ]);

  for (const [channel, expr] of channelExprs) {
    if (!skip.has(channel)) {
      style[channel] = expr;
    }
  }

  // Assemble fill-color from sub-channels if any fill-* sub-channel is present.
  if (FILL_SUB.some(c => channelExprs.has(c)) || FILL_ALPHA_SUB.some(c => channelExprs.has(c))) {
    const r = channelExprs.get('fill-red') ?? 0;
    const g = channelExprs.get('fill-green') ?? 0;
    const b = channelExprs.get('fill-blue') ?? 0;
    const a = channelExprs.get('fill-alpha') ?? 1;
    // Merge with any direct fill-color — sub-channels take precedence.
    style['fill-color'] = ['array', r, g, b, a];
  }

  // Assemble pixel-color similarly.
  if (PIXEL_SUB.some(c => channelExprs.has(c)) || PIXEL_ALPHA_SUB.some(c => channelExprs.has(c))) {
    const r = channelExprs.get('pixel-red') ?? 0;
    const g = channelExprs.get('pixel-green') ?? 0;
    const b = channelExprs.get('pixel-blue') ?? 0;
    const a = channelExprs.get('pixel-alpha') ?? 1;
    style['pixel-color'] = ['array', r, g, b, a];
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
// Mapping compilation — dispatches by outputType then scale scheme
// ---------------------------------------------------------------------------

function compileMapping(
  field: string | undefined,
  mapping: IMapping,
): ExpressionValue {
  switch (mapping.outputType) {
    case 'rgba':
      return compileRGBAScale(field, mapping.scale);
    case 'uint8':
    case 'unorm':
    case 'posfloat':
      return compileNumericScale(field, mapping.scale);
  }
}

function compileRGBAScale(
  field: string | undefined,
  scale: IMapping & { outputType: 'rgba' } extends { scale: infer S } ? S : never,
): ExpressionValue {
  switch (scale.scheme) {
    case 'colorRamp':
      return compileColorRamp(field!, scale);
    case 'categorical':
      return compileCategorical(field!, scale);
    case 'kde':
      // KDE compilation is handled at the layer level (HeatmapLayer), not here.
      // Return a transparent placeholder so the FlatStyle doesn't break.
      return 'rgba(0,0,0,0)';
    case 'constant':
      return scale.value as RGBA;
    case 'identity':
      return ['get', field!];
  }
}

function compileNumericScale(
  field: string | undefined,
  scale: IMapping & { outputType: 'posfloat' } extends { scale: infer S } ? S : never,
): ExpressionValue {
  switch (scale.scheme) {
    case 'scalar':
      return compileScalar(field!, scale);
    case 'constant':
      return scale.value as number;
    case 'identity':
      return ['get', field!];
  }
}

// ---------------------------------------------------------------------------
// Scale compilers
// ---------------------------------------------------------------------------

/**
 * colorRamp: numeric field → RGBA color via a named palette.
 *
 * Output:
 *   ['case', ['has', field],
 *     ['interpolate', ['linear'], ['get', field], stop0, color0, ...],
 *     fallbackCss]
 */
function compileColorRamp(
  field: string,
  scale: IColorRampScale,
): ExpressionValue {
  const stops = resolveColorStops(scale);

  const interpolateExpr: ExpressionValue[] = [
    'interpolate',
    ['linear'],
    ['get', field],
  ];
  for (const { stop, color } of stops) {
    interpolateExpr.push(stop, color as ExpressionValue);
  }

  return ['case', ['has', field], interpolateExpr, scale.fallback];
}

/**
 * Resolve color stops for a colorRamp scale.
 * Uses explicit colorStops if present; otherwise samples the named palette.
 */
function resolveColorStops(
  scale: IColorRampScale,
): Array<{ stop: number; color: RGBA }> {
  if (scale.colorStops && scale.colorStops.length >= 2) {
    return scale.colorStops;
  }

  let colors: number[][] = colormap({
    colormap: scale.name,
    nshades: Math.max(scale.nShades, 9),
    format: 'rgba',
  });

  if (scale.reverse) {
    colors = [...colors].reverse();
  }

  const n = scale.nShades;
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    const stopValue = scale.domain[0] + t * (scale.domain[1] - scale.domain[0]);
    const colorIndex = Math.round(t * (colors.length - 1));
    const c = colors[colorIndex];
    return {
      stop: stopValue,
      color: [c[0], c[1], c[2], c[3] ?? 1] as RGBA,
    };
  });
}

/**
 * categorical: nominal field → RGBA color via an explicit value→color mapping.
 *
 * Output:
 *   ['case',
 *     ['==', ['get', field], val0], cssColor0,
 *     ...,
 *     fallbackCss]
 */
function compileCategorical(
  field: string,
  scale: ICategoricalScale,
): ExpressionValue {
  const caseExpr: ExpressionValue[] = ['case'];
  for (const [value, color] of Object.entries(scale.mapping)) {
    caseExpr.push(['==', ['get', field], value], color);
  }
  caseExpr.push(scale.fallback);
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
function compileScalar(
  field: string,
  scale: IScalarScale,
): ExpressionValue {
  const interpolateExpr: ExpressionValue[] = [
    'interpolate',
    ['linear'],
    ['get', field],
  ];

  if (scale.scalarStops && scale.scalarStops.length >= 2) {
    for (const { stop, output } of scale.scalarStops) {
      interpolateExpr.push(stop, output);
    }
  } else {
    interpolateExpr.push(
      scale.domain[0], scale.range[0],
      scale.domain[1], scale.range[1],
    );
  }

  return ['case', ['has', field], interpolateExpr, scale.fallback];
}

