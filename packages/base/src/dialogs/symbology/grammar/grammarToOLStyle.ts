/**
 * Grammar → OL FlatStyle compiler.
 *
 * grammarToOLStyle(state) takes an IGrammarSymbologyState and returns a merged
 * OL FlatStyle object ready to be stored in layer.parameters.color.
 *
 * Each rule produces one OL expression for rule.channel.  When a rule has
 * `when` predicates they are compiled to OL conditions and the expression is
 * wrapped in a `['case', ...]` guard.
 */

import colormap from 'colormap';
import { ExpressionValue } from 'ol/expr/expression';

import { IEncodingRule, IGrammarSymbologyState, IPredicate, IScale, OLStyleChannel } from './types';

const COLOR_CHANNELS = new Set<OLStyleChannel>([
  'fill-color', 'stroke-color', 'circle-fill-color', 'circle-stroke-color',
]);

/** Convert an RGBA quad to a CSS color string safe for use in OL case expressions. */
function rgbaToCss(c: [number, number, number, number]): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`;
}

/** Typed zero-value fallback for channels not matched by a guard. */
function channelFallback(channel: OLStyleChannel): ExpressionValue {
  return COLOR_CHANNELS.has(channel) ? 'rgba(0,0,0,0)' : 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function grammarToOLStyle(
  state: IGrammarSymbologyState,
): Record<string, any> {
  const style: Record<string, any> = { ...(state.baseStyle ?? {}) };

  for (const rule of state.rules) {
    style[rule.channel] = compileRule(rule);
  }

  return style;
}

// ---------------------------------------------------------------------------
// Rule compilation
// ---------------------------------------------------------------------------

function compileRule(rule: IEncodingRule): ExpressionValue {
  const expr = compileScale(rule.field, rule.scale);

  if (!rule.when || rule.when.length === 0) {
    return expr;
  }

  // Compile each predicate and AND them together.
  const conditions = rule.when.map(compilePredicate);
  const guard: ExpressionValue =
    conditions.length === 1 ? conditions[0] : ['all', ...conditions];

  // Features that don't match fall through to a typed zero-value for the channel.
  return ['case', guard, expr, channelFallback(rule.channel)];
}

function compilePredicate(predicate: IPredicate): ExpressionValue {
  switch (predicate.type) {
    case 'geometryType':
      return ['==', ['geometry-type'], olGeomType(predicate.value)];
    case 'hasField':
      return ['has', predicate.field];
    case 'fieldEquals':
      return ['==', ['get', predicate.field], predicate.value];
  }
}

function olGeomType(value: 'point' | 'line' | 'polygon'): string {
  const map: Record<string, string> = {
    point: 'Point',
    line: 'LineString',
    polygon: 'Polygon',
  };
  return map[value];
}

function compileScale(field: string | undefined, scale: IScale): ExpressionValue {
  switch (scale.scheme) {
    case 'colorRamp':
      return compileColorRamp(field!, scale);
    case 'categorical':
      return compileCategorical(field!, scale);
    case 'scalar':
      return compileScalar(field!, scale);
    case 'constant':
      return scale.value;
    case 'identity':
      return ['get', field!];
  }
}

// ---------------------------------------------------------------------------
// Scale compilers
// ---------------------------------------------------------------------------

/**
 * colorRamp: numeric field → color via a named palette.
 *
 * Produces:
 *   ['case', ['has', field],
 *     ['interpolate', ['linear'], ['get', field], stop0, color0, ...],
 *     fallback]
 */
function compileColorRamp(
  field: string,
  scale: Extract<IScale, { scheme: 'colorRamp' }>,
): ExpressionValue {
  let colors: number[][] = colormap({
    colormap: scale.name,
    nshades: Math.max(scale.nShades, 9),
    format: 'rgba',
  });

  if (scale.reverse) {
    colors = [...colors].reverse();
  }

  const interpolateExpr: ExpressionValue[] = [
    'interpolate',
    ['linear'],
    ['get', field],
  ];

  if (scale.colorStops && scale.colorStops.length >= 2) {
    scale.colorStops.forEach(({ stop, color }) => {
      interpolateExpr.push(stop, color);
    });
  } else {
    // Evenly-spaced stops across the domain from the ramp.
    const n = scale.nShades;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      const stopValue = scale.domain[0] + t * (scale.domain[1] - scale.domain[0]);
      const colorIndex = Math.round(t * (colors.length - 1));
      interpolateExpr.push(stopValue, colors[colorIndex]);
    }
  }

  // Use a CSS string for the fallback — OL's CPU evaluator cannot parse a
  // bare [r,g,b,a] array as a color-like expression inside a `case` branch.
  return ['case', ['has', field], interpolateExpr, rgbaToCss(scale.fallback)];
}

/**
 * categorical: nominal field → color via an explicit value→color mapping.
 *
 * Produces:
 *   ['case',
 *     ['==', ['get', field], val0], color0, ...
 *     fallback]
 */
function compileCategorical(
  field: string,
  scale: Extract<IScale, { scheme: 'categorical' }>,
): ExpressionValue {
  const caseExpr: ExpressionValue[] = ['case'];

  for (const [value, color] of Object.entries(scale.mapping)) {
    caseExpr.push(['==', ['get', field], value], color);
  }

  caseExpr.push(scale.fallback);
  return caseExpr;
}

/**
 * scalar: numeric field → numeric output (e.g. radius, stroke-width).
 *
 * Produces:
 *   ['case', ['has', field],
 *     ['interpolate', ['linear'], ['get', field], stop0, out0, ...],
 *     fallback]
 */
function compileScalar(
  field: string,
  scale: Extract<IScale, { scheme: 'scalar' }>,
): ExpressionValue {
  const interpolateExpr: ExpressionValue[] = [
    'interpolate',
    ['linear'],
    ['get', field],
  ];

  if (scale.scalarStops && scale.scalarStops.length >= 2) {
    scale.scalarStops.forEach(({ stop, output }) => {
      interpolateExpr.push(stop, output);
    });
  } else {
    interpolateExpr.push(
      scale.domain[0], scale.range[0],
      scale.domain[1], scale.range[1],
    );
  }

  return ['case', ['has', field], interpolateExpr, scale.fallback];
}
