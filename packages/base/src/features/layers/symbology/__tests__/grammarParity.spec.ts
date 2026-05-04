/**
 * Parity tests: Grammar compiler must produce OL expressions equivalent to
 * buildVectorFlatStyle() for all existing render types.
 *
 * These are the acceptance criterion for Step 1 of the Grammar migration.
 * Once all pass, grammarToOLStyle() is a verified replacement for the old
 * builder on Graduated, Categorized, and Single Symbol render types.
 */

// Type-only OL imports — mock to avoid loading ESM packages.
jest.mock('ol/expr/expression', () => ({}));
jest.mock('ol/style/flat', () => ({}));
jest.mock('@jupytergis/schema', () => ({}));
jest.mock('geotiff', () => ({ Pool: class {}, fromUrl: jest.fn() }));
jest.mock('../tiff_layer/types/SingleBandPseudoColor', () => ({}));
jest.mock('@/src/tools', () => ({ objectEntries: Object.entries }));

import { buildVectorFlatStyle, SymbologyState } from '../styleBuilder';
import {
  graduatedToGrammar,
  categorizedToGrammar,
  singleSymbolToGrammar,
} from '../grammar/grammarConversions';
import { grammarToOLStyle } from '../grammar/grammarToOLStyle';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract stop values from an interpolate expression nested inside a case:
 *   ['case', ['has', field], ['interpolate', ['linear'], ['get', field], v0, c0, ...], fallback]
 */
function extractInterpolateStopValues(expr: any): number[] {
  const interpolate = expr?.[2];
  if (!Array.isArray(interpolate) || interpolate[0] !== 'interpolate') {
    return [];
  }
  const values: number[] = [];
  for (let i = 3; i < interpolate.length; i += 2) {
    values.push(interpolate[i] as number);
  }
  return values;
}

/**
 * Extract stop colors from an interpolate expression.
 */
function extractInterpolateStopColors(expr: any): any[] {
  const interpolate = expr?.[2];
  if (!Array.isArray(interpolate) || interpolate[0] !== 'interpolate') {
    return [];
  }
  const colors: any[] = [];
  for (let i = 4; i < interpolate.length; i += 2) {
    colors.push(interpolate[i]);
  }
  return colors;
}

/**
 * Extract (value, color) pairs from a categorical case expression:
 *   ['case', ['==', ['get', field], v0], c0, ['==', ...], c1, ..., fallback]
 */
function extractCaseEntries(expr: any): Array<{ value: any; color: any }> {
  if (!Array.isArray(expr) || expr[0] !== 'case') {
    return [];
  }
  const entries: Array<{ value: any; color: any }> = [];
  for (let i = 1; i < expr.length - 1; i += 2) {
    const condition = expr[i];
    const color = expr[i + 1];
    if (Array.isArray(condition) && condition[0] === '==') {
      entries.push({ value: condition[2], color });
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Single Symbol parity
// ---------------------------------------------------------------------------

describe('Grammar parity — Single Symbol', () => {
  const state: SymbologyState = {
    renderType: 'Single Symbol',
    fillColor: [255, 0, 0, 1],
    strokeColor: [0, 0, 0, 1],
    strokeWidth: 2,
    radius: 6,
  } as unknown as SymbologyState;

  it('fill-color matches', () => {
    const old = buildVectorFlatStyle(state, []) as any;
    const grammar = singleSymbolToGrammar(state);
    const next = grammarToOLStyle(grammar) as any;
    expect(next['fill-color']).toEqual(old['fill-color']);
  });

  it('stroke-color matches', () => {
    const old = buildVectorFlatStyle(state, []) as any;
    const grammar = singleSymbolToGrammar(state);
    const next = grammarToOLStyle(grammar) as any;
    expect(next['stroke-color']).toEqual(old['stroke-color']);
  });

  it('stroke-width matches', () => {
    const old = buildVectorFlatStyle(state, []) as any;
    const grammar = singleSymbolToGrammar(state);
    const next = grammarToOLStyle(grammar) as any;
    expect(next['stroke-width']).toEqual(old['stroke-width']);
  });

  it('circle-radius matches', () => {
    const old = buildVectorFlatStyle(state, []) as any;
    const grammar = singleSymbolToGrammar(state);
    const next = grammarToOLStyle(grammar) as any;
    expect(next['circle-radius']).toEqual(old['circle-radius']);
  });

  it('circle-fill-color matches', () => {
    const old = buildVectorFlatStyle(state, []) as any;
    const grammar = singleSymbolToGrammar(state);
    const next = grammarToOLStyle(grammar) as any;
    expect(next['circle-fill-color']).toEqual(old['circle-fill-color']);
  });
});

// ---------------------------------------------------------------------------
// Graduated parity
// ---------------------------------------------------------------------------

describe('Grammar parity — Graduated (equal interval)', () => {
  const state: SymbologyState = {
    renderType: 'Graduated',
    value: 'magnitude',
    colorRamp: 'viridis',
    nClasses: 5,
    mode: 'equal interval',
    vmin: 0,
    vmax: 100,
    fallbackColor: [0, 0, 0, 0],
    strokeColor: [0, 0, 0, 1],
    strokeWidth: 1,
    radius: 5,
  } as unknown as SymbologyState;

  const featureValues = [0, 20, 40, 60, 80, 100];

  it('fill-color is a case expression', () => {
    const grammar = graduatedToGrammar(state, featureValues);
    const next = grammarToOLStyle(grammar) as any;
    expect(next['fill-color']?.[0]).toBe('case');
    expect(next['fill-color']?.[1]).toEqual(['has', 'magnitude']);
    expect(next['fill-color']?.[2]?.[0]).toBe('interpolate');
  });

  it('interpolate stop values match old builder', () => {
    const old = buildVectorFlatStyle(state, featureValues) as any;
    const grammar = graduatedToGrammar(state, featureValues);
    const next = grammarToOLStyle(grammar) as any;

    const oldStops = extractInterpolateStopValues(old['fill-color']);
    const newStops = extractInterpolateStopValues(next['fill-color']);
    expect(newStops).toEqual(oldStops);
  });

  it('interpolate stop colors match old builder', () => {
    const old = buildVectorFlatStyle(state, featureValues) as any;
    const grammar = graduatedToGrammar(state, featureValues);
    const next = grammarToOLStyle(grammar) as any;

    const oldColors = extractInterpolateStopColors(old['fill-color']);
    const newColors = extractInterpolateStopColors(next['fill-color']);
    expect(newColors).toEqual(oldColors);
  });

  it('circle-fill-color matches fill-color', () => {
    const grammar = graduatedToGrammar(state, featureValues);
    const next = grammarToOLStyle(grammar) as any;
    expect(next['circle-fill-color']).toEqual(next['fill-color']);
  });

  it('stroke-width matches', () => {
    const old = buildVectorFlatStyle(state, featureValues) as any;
    const grammar = graduatedToGrammar(state, featureValues);
    const next = grammarToOLStyle(grammar) as any;
    expect(next['stroke-width']).toEqual(old['stroke-width']);
  });
});

describe('Grammar parity — Graduated (quantile)', () => {
  const state: SymbologyState = {
    renderType: 'Graduated',
    value: 'population',
    colorRamp: 'plasma',
    nClasses: 4,
    mode: 'quantile',
    fallbackColor: [0, 0, 0, 0],
    strokeColor: [0, 0, 0, 1],
    strokeWidth: 1,
    radius: 5,
  } as unknown as SymbologyState;

  const featureValues = [10, 20, 30, 40, 50, 60, 70, 80];

  it('interpolate stop values match old builder', () => {
    const old = buildVectorFlatStyle(state, featureValues) as any;
    const grammar = graduatedToGrammar(state, featureValues);
    const next = grammarToOLStyle(grammar) as any;

    const oldStops = extractInterpolateStopValues(old['fill-color']);
    const newStops = extractInterpolateStopValues(next['fill-color']);
    expect(newStops).toEqual(oldStops);
  });
});

// ---------------------------------------------------------------------------
// Categorized parity
// ---------------------------------------------------------------------------

describe('Grammar parity — Categorized', () => {
  const state: SymbologyState = {
    renderType: 'Categorized',
    value: 'category',
    colorRamp: 'viridis',
    fallbackColor: [0, 0, 0, 0],
    strokeColor: [0, 0, 0, 1],
    strokeWidth: 1,
    radius: 5,
  } as unknown as SymbologyState;

  const featureValues = ['A', 'B', 'C'];

  it('fill-color is a case expression', () => {
    const grammar = categorizedToGrammar(state, featureValues);
    const next = grammarToOLStyle(grammar) as any;
    expect(next['fill-color']?.[0]).toBe('case');
  });

  it('case entry values match old builder', () => {
    const old = buildVectorFlatStyle(state, featureValues) as any;
    const grammar = categorizedToGrammar(state, featureValues);
    const next = grammarToOLStyle(grammar) as any;

    const oldEntries = extractCaseEntries(old['fill-color']);
    const newEntries = extractCaseEntries(next['fill-color']);

    expect(newEntries.map(e => e.value)).toEqual(oldEntries.map(e => e.value));
  });

  it('case entry colors match old builder', () => {
    const old = buildVectorFlatStyle(state, featureValues) as any;
    const grammar = categorizedToGrammar(state, featureValues);
    const next = grammarToOLStyle(grammar) as any;

    const oldEntries = extractCaseEntries(old['fill-color']);
    const newEntries = extractCaseEntries(next['fill-color']);

    expect(newEntries.map(e => e.color)).toEqual(
      oldEntries.map(e => e.color),
    );
  });

  it('circle-fill-color matches fill-color', () => {
    const grammar = categorizedToGrammar(state, featureValues);
    const next = grammarToOLStyle(grammar) as any;
    expect(next['circle-fill-color']).toEqual(next['fill-color']);
  });
});
