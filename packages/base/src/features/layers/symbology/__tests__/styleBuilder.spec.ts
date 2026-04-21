// Type-only OL imports — mock to avoid loading ESM packages.
jest.mock('ol/expr/expression', () => ({}));
jest.mock('ol/style/flat', () => ({}));
// Schema types only at runtime.
jest.mock('@jupytergis/schema', () => ({}));
// Transitive deps of classificationModes and colorRampUtils.
jest.mock('geotiff', () => ({ Pool: class {}, fromUrl: jest.fn() }));
jest.mock('../tiff_layer/types/SingleBandPseudoColor', () => ({}));
jest.mock('@/src/tools', () => ({ objectEntries: Object.entries }));

import { buildVectorFlatStyle, SymbologyState } from '../styleBuilder';

// The graduated fill-color expression has the shape:
//   ['case', ['has', field], ['interpolate', ['linear'], ['get', field], v0, c0, v1, c1, …], fallback]
// Pull out just the stop values from the interpolate sub-expression.
function graduatedStopValues(
  style: ReturnType<typeof buildVectorFlatStyle>,
): number[] {
  const fillColor = (style as any)['fill-color'] as any[];
  const interpolate = fillColor[2] as any[];
  const values: number[] = [];
  for (let i = 3; i < interpolate.length; i += 2) {
    values.push(interpolate[i] as number);
  }
  return values;
}

const BASE_STATE: SymbologyState = {
  renderType: 'Graduated',
  value: 'magnitude',
  colorRamp: 'viridis',
  nClasses: 5,
  mode: 'equal interval',
} as unknown as SymbologyState;

describe('buildVectorFlatStyle — Single Symbol', () => {
  it('returns a style with the configured fill color', () => {
    const state = {
      renderType: 'Single Symbol',
      fillColor: [255, 0, 0, 1],
      strokeColor: [0, 0, 0, 1],
      strokeWidth: 1,
    } as unknown as SymbologyState;
    const style = buildVectorFlatStyle(state, []);
    expect((style as any)?.['fill-color']).toEqual([255, 0, 0, 1]);
  });
});

describe('buildVectorFlatStyle — Graduated (equal interval)', () => {
  const state = {
    ...BASE_STATE,
    vmin: 0,
    vmax: 100,
  } as unknown as SymbologyState;

  it('produces an interpolate expression for fill-color', () => {
    const style = buildVectorFlatStyle(state, []);
    const fillColor = (style as any)?.['fill-color'];
    expect(fillColor?.[0]).toBe('case');
    expect(fillColor?.[2]?.[0]).toBe('interpolate');
  });

  it('gradient starts exactly at vmin', () => {
    const stopValues = graduatedStopValues(buildVectorFlatStyle(state, []));
    expect(stopValues[0]).toBe(0);
  });

  it('gradient ends exactly at vmax', () => {
    const stopValues = graduatedStopValues(buildVectorFlatStyle(state, []));
    expect(stopValues[stopValues.length - 1]).toBe(100);
  });

  it('gradient covers the full range — all expected stops are present', () => {
    // Equal interval [0, 100] with 5 classes → stops at 0, 20, 40, 60, 80, 100.
    // Currently failing: the pinning overwrites stops[0] with vmin, destroying
    // the first class boundary and producing [0, 40, 60, 80, 100] instead.
    const stopValues = graduatedStopValues(buildVectorFlatStyle(state, []));
    expect(stopValues).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('every stop has an assigned color', () => {
    const style = buildVectorFlatStyle(state, []) as any;
    const interpolate = style['fill-color'][2] as any[];
    // Headers are at indices 0,1,2; then alternating (value, color) pairs.
    const nStops = (interpolate.length - 3) / 2;
    const stopValues = graduatedStopValues(style);
    expect(nStops).toBe(stopValues.length);
  });

  it('uses feature values when no vmin/vmax is set', () => {
    const stateNoRange = { ...BASE_STATE } as unknown as SymbologyState;
    const style = buildVectorFlatStyle(stateNoRange, [0, 25, 50, 75, 100]);
    const stopValues = graduatedStopValues(style);
    expect(stopValues[0]).toBe(0);
    expect(stopValues[stopValues.length - 1]).toBe(100);
  });
});
