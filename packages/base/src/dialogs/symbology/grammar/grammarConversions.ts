/**
 * Conversions between Grammar rules and the other render-type states.
 *
 * Direction A (any → Grammar): called when the user switches TO Grammar.
 * Direction B (Grammar → other): called when the user switches FROM Grammar.
 */

import { UUID } from '@lumino/coreutils';

import { IColorRampScale, IEncodingRule, IGrammarSymbologyState, OLStyleChannel } from './types';

// ---------------------------------------------------------------------------
// Helpers: parse compiled OL expressions back to stop arrays
// ---------------------------------------------------------------------------

function extractInterpolateExpr(expr: any): any[] | null {
  if (!Array.isArray(expr)) {
    return null;
  }
  // New format: ['case', ['has', field], interpolateExpr, fallback]
  if (expr[0] === 'case' && expr.length >= 3) {
    expr = expr[2];
  }
  if (Array.isArray(expr) && expr[0] === 'interpolate') {
    return expr;
  }
  return null;
}

function extractColorStops(
  expr: any,
): Array<{ stop: number; color: [number, number, number, number] }> {
  const interp = extractInterpolateExpr(expr);
  if (!interp) {
    return [];
  }
  const stops: Array<{ stop: number; color: [number, number, number, number] }> = [];
  for (let i = 3; i < interp.length - 1; i += 2) {
    const stop = interp[i];
    const color = interp[i + 1];
    if (typeof stop === 'number' && Array.isArray(color)) {
      stops.push({
        stop,
        color: [color[0], color[1], color[2], color[3] ?? 1] as [number, number, number, number],
      });
    }
  }
  return stops;
}

function extractScalarStops(
  expr: any,
): Array<{ stop: number; output: number }> {
  const interp = extractInterpolateExpr(expr);
  if (!interp) {
    return [];
  }
  const stops: Array<{ stop: number; output: number }> = [];
  for (let i = 3; i < interp.length - 1; i += 2) {
    const stop = interp[i];
    const output = interp[i + 1];
    if (typeof stop === 'number' && typeof output === 'number') {
      stops.push({ stop, output });
    }
  }
  return stops;
}

function colorArrayToCss(c: any): string {
  if (typeof c === 'string') {
    return c;
  }
  if (Array.isArray(c) && c.length >= 3) {
    return `rgba(${c[0]},${c[1]},${c[2]},${c[3] ?? 1})`;
  }
  return 'rgba(0,0,0,0)';
}

// ---------------------------------------------------------------------------
// Direction A: any render type → Grammar rules
// ---------------------------------------------------------------------------

export function graduatedToGrammarRules(
  symbologyState: any,
  color: Record<string, any>,
): IEncodingRule[] {
  const field = symbologyState?.value;
  if (!field) {
    return [];
  }

  const fillExpr = color?.['fill-color'];
  const colorStops = extractColorStops(fillExpr);

  const domain: [number, number] =
    colorStops.length >= 2
      ? [colorStops[0].stop, colorStops[colorStops.length - 1].stop]
      : [symbologyState?.vmin ?? 0, symbologyState?.vmax ?? 1];

  const baseScale: IColorRampScale = {
    scheme: 'colorRamp',
    name: symbologyState?.colorRamp ?? 'viridis',
    domain,
    nShades: symbologyState?.nClasses ?? 9,
    mode: symbologyState?.mode ?? 'equal interval',
    reverse: symbologyState?.reverseRamp ?? false,
    fallback: symbologyState?.fallbackColor ?? [0, 0, 0, 0],
    colorStops: colorStops.length >= 2 ? colorStops : undefined,
  };

  const rules: IEncodingRule[] = [
    {
      id: UUID.uuid4(),
      field,
      channel: 'fill-color',
      scale: { ...baseScale },
    },
    {
      id: UUID.uuid4(),
      field,
      channel: 'circle-fill-color',
      scale: { ...baseScale },
    },
  ];

  const radiusExpr = color?.['circle-radius'];
  const scalarStops = extractScalarStops(radiusExpr);
  if (scalarStops.length >= 2) {
    rules.push({
      id: UUID.uuid4(),
      field,
      channel: 'circle-radius',
      scale: {
        scheme: 'scalar',
        domain: [scalarStops[0].stop, scalarStops[scalarStops.length - 1].stop],
        range: [scalarStops[0].output, scalarStops[scalarStops.length - 1].output],
        mode: symbologyState?.mode ?? 'equal interval',
        nStops: symbologyState?.nClasses ?? 9,
        fallback: 0,
        scalarStops,
      },
    });
  }

  return rules;
}

export function categorizedToGrammarRules(
  symbologyState: any,
  color: Record<string, any>,
): IEncodingRule[] {
  const field = symbologyState?.value;
  if (!field) {
    return [];
  }

  const fillExpr = color?.['fill-color'];
  const mapping: Record<string, string> = {};
  let fallback = 'rgba(0,0,0,0)';

  if (Array.isArray(fillExpr) && fillExpr[0] === 'case') {
    for (let i = 1; i < fillExpr.length - 1; i += 2) {
      const cond = fillExpr[i];
      const colorVal = fillExpr[i + 1];
      if (
        Array.isArray(cond) &&
        cond[0] === '==' &&
        Array.isArray(cond[1]) &&
        cond[1][0] === 'get'
      ) {
        mapping[String(cond[2])] = colorArrayToCss(colorVal);
      }
    }
    fallback = colorArrayToCss(fillExpr[fillExpr.length - 1]);
  }

  return [
    {
      id: UUID.uuid4(),
      field,
      channel: 'fill-color',
      scale: { scheme: 'categorical', mapping, fallback },
    },
    {
      id: UUID.uuid4(),
      field,
      channel: 'circle-fill-color',
      scale: { scheme: 'categorical', mapping, fallback },
    },
  ];
}

export function singleSymbolToGrammarRules(
  color: Record<string, any>,
): IEncodingRule[] {
  if (!color) {
    return [];
  }
  const rules: IEncodingRule[] = [];
  const COLOR_CH: OLStyleChannel[] = ['fill-color', 'stroke-color', 'circle-fill-color', 'circle-stroke-color'];
  const NUM_CH: OLStyleChannel[] = ['stroke-width', 'circle-radius', 'circle-stroke-width'];

  for (const ch of COLOR_CH) {
    const val = color[ch];
    if (val !== undefined) {
      rules.push({
        id: UUID.uuid4(),
        channel: ch,
        scale: { scheme: 'constant', value: colorArrayToCss(val) },
      });
    }
  }
  for (const ch of NUM_CH) {
    const val = color[ch];
    if (typeof val === 'number') {
      rules.push({
        id: UUID.uuid4(),
        channel: ch,
        scale: { scheme: 'constant', value: val },
      });
    }
  }
  return rules;
}

/**
 * Convert any non-Grammar symbologyState → Grammar rules.
 * Returns null if the state is already Grammar or conversion is not possible.
 */
export function anyStateToGrammarRules(
  symbologyState: any,
  color: Record<string, any>,
): IEncodingRule[] | null {
  switch (symbologyState?.renderType) {
    case 'Graduated':
      return graduatedToGrammarRules(symbologyState, color);
    case 'Categorized':
      return categorizedToGrammarRules(symbologyState, color);
    case 'Single Symbol':
      return singleSymbolToGrammarRules(color ?? {});
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Direction B: Grammar rules → other render-type state seeds
// ---------------------------------------------------------------------------

/**
 * Extract Graduated-compatible state from Grammar rules.
 * Returns partial overrides for symbologyState; caller merges with existing.
 */
export function grammarRulesToGraduatedSeed(
  grammarState: IGrammarSymbologyState,
): Partial<Record<string, any>> {
  const colorRule = grammarState.rules.find(
    r =>
      (r.channel === 'fill-color' || r.channel === 'circle-fill-color') &&
      r.scale.scheme === 'colorRamp',
  );
  const radiusRule = grammarState.rules.find(
    r => r.channel === 'circle-radius' && r.scale.scheme === 'scalar',
  );

  if (!colorRule && !radiusRule) {
    return {};
  }

  const seed: Record<string, any> = {};

  if (colorRule && colorRule.scale.scheme === 'colorRamp') {
    const s = colorRule.scale;
    seed.value = colorRule.field;
    seed.colorRamp = s.name;
    seed.nClasses = s.nShades;
    seed.mode = s.mode;
    seed.reverseRamp = s.reverse;
    seed.vmin = s.domain[0];
    seed.vmax = s.domain[1];
    seed.fallbackColor = s.fallback;
  } else if (radiusRule && radiusRule.scale.scheme === 'scalar') {
    const s = radiusRule.scale;
    seed.value = radiusRule.field;
    seed.mode = s.mode;
    seed.vmin = s.domain[0];
    seed.vmax = s.domain[1];
    seed.method = 'radius';
  }

  return seed;
}

/**
 * Extract Categorized-compatible state from Grammar rules.
 */
export function grammarRulesToCategorizedSeed(
  grammarState: IGrammarSymbologyState,
): Partial<Record<string, any>> {
  const catRule = grammarState.rules.find(
    r =>
      (r.channel === 'fill-color' || r.channel === 'circle-fill-color') &&
      r.scale.scheme === 'categorical',
  );
  if (!catRule || catRule.scale.scheme !== 'categorical') {
    return {};
  }
  return { value: catRule.field };
}

/**
 * Pick the best reverse-conversion target based on Grammar rule types present.
 */
export function grammarToSuggestedRenderType(
  grammarState: IGrammarSymbologyState,
): 'Graduated' | 'Categorized' | 'Single Symbol' {
  const schemes = grammarState.rules.map(r => r.scale.scheme);
  if (schemes.includes('colorRamp') || schemes.includes('scalar')) {
    return 'Graduated';
  }
  if (schemes.includes('categorical')) {
    return 'Categorized';
  }
  return 'Single Symbol';
}
