/**
 * Unit tests for the shared stop resolvers.
 *
 * These cover the contract the style compiler, the editor preview and the
 * legend all depend on: stops are derived from the data unless the user pinned
 * them by hand, and the derivation is identical for all three callers.
 */

jest.mock('ol/expr/expression', () => ({}));
jest.mock('ol/style/flat', () => ({}));
jest.mock('@jupytergis/schema', () => ({}));
jest.mock('geotiff', () => ({ Pool: class {}, fromUrl: jest.fn() }));
jest.mock('@/src/tools', () => ({ objectEntries: Object.entries }));

import {
  ICategoricalScaleParams,
  IColorMapScaleParams,
  IGrammarSymbologyState,
  IScalarScaleParams,
} from '@jupytergis/schema';

import {
  colorMapClassCount,
  deriveColorMapStops,
  grammarNeedsFeatureValues,
  resolveCategoricalStops,
  resolveColorMapStops,
  resolveScalarStops,
} from '../resolveStops';

const colorMapParams = (
  overrides: Partial<IColorMapScaleParams> = {},
): IColorMapScaleParams => ({
  name: 'viridis',
  nShades: 5,
  mode: 'equal interval',
  reverse: false,
  fallback: [0, 0, 0, 0],
  ...overrides,
});

const categoricalParams = (
  overrides: Partial<ICategoricalScaleParams> = {},
): ICategoricalScaleParams => ({
  colorRamp: 'viridis',
  fallback: [0, 0, 0, 0],
  ...overrides,
});

const scalarParams = (
  overrides: Partial<IScalarScaleParams> = {},
): IScalarScaleParams => ({
  domain: [0, 100],
  range: [1, 10],
  fallback: 1,
  ...overrides,
});

describe('resolveColorMapStops', () => {
  it('classifies from feature values when no stops are persisted', () => {
    const stops = resolveColorMapStops(colorMapParams(), [0, 25, 50, 75, 100]);

    expect(stops.length).toBeGreaterThanOrEqual(2);
    expect(stops[0].stop).toBe(0);
    expect(stops[stops.length - 1].stop).toBe(100);
  });

  it('classifies from the domain alone when no feature values are available', () => {
    // The vector-tile case: the full feature population is never loaded, so an
    // explicit domain is the only stable way to classify.
    const stops = resolveColorMapStops(
      colorMapParams({ domain: [30, 110] }),
      [],
    );

    expect(stops.length).toBeGreaterThanOrEqual(2);
    expect(stops[0].stop).toBe(30);
    expect(stops[stops.length - 1].stop).toBe(110);
  });

  it('returns nothing when there is neither data nor a domain', () => {
    expect(resolveColorMapStops(colorMapParams(), [])).toEqual([]);
  });

  it('prefers persisted stops over the data', () => {
    const colorStops = [
      { stop: 1, color: [1, 2, 3, 1] as [number, number, number, number] },
      { stop: 2, color: [4, 5, 6, 1] as [number, number, number, number] },
    ];
    expect(
      resolveColorMapStops(colorMapParams({ colorStops }), [0, 50, 100]),
    ).toBe(colorStops);
  });

  it('ignores a single persisted stop, which cannot drive an interpolation', () => {
    const stops = resolveColorMapStops(
      colorMapParams({
        domain: [0, 10],
        colorStops: [{ stop: 1, color: [1, 2, 3, 1] }],
      }),
      [],
    );
    expect(stops.length).toBeGreaterThanOrEqual(2);
  });
});

describe('colorMapClassCount', () => {
  it('passes nShades through for ramps with no minimum', () => {
    expect(colorMapClassCount(colorMapParams({ nShades: 3 }))).toBe(3);
  });

  it('clamps to the ramp minimum so the preview and the map agree', () => {
    // The Classes input is unclamped, so a ramp with a documented minimum has
    // to be clamped wherever stops are derived — not just in the editor.
    const params = colorMapParams({ name: 'hsv', nShades: 3 });
    expect(colorMapClassCount(params)).toBeGreaterThan(3);
    expect(deriveColorMapStops(params, [0, 100]).length).toBe(
      colorMapClassCount(params) + 1,
    );
  });
});

describe('resolveCategoricalStops', () => {
  it('enumerates categories from the data when no stops are persisted', () => {
    const stops = resolveCategoricalStops(categoricalParams(), [
      'a',
      'b',
      'a',
      'c',
    ]);
    expect(stops.map(s => s.stop)).toEqual(['a', 'b', 'c']);
  });

  it('returns nothing without data — categories are unknowable', () => {
    expect(resolveCategoricalStops(categoricalParams(), [])).toEqual([]);
  });

  it('prefers persisted stops over the data', () => {
    const colorStops = [
      { stop: 'x', color: [1, 2, 3, 1] as [number, number, number, number] },
    ];
    expect(
      resolveCategoricalStops(categoricalParams({ colorStops }), ['a', 'b']),
    ).toBe(colorStops);
  });
});

describe('resolveScalarStops', () => {
  it('uses the domain and range endpoints when no stops are persisted', () => {
    expect(resolveScalarStops(scalarParams())).toEqual([
      { stop: 0, output: 1 },
      { stop: 100, output: 10 },
    ]);
  });

  it('prefers persisted stops', () => {
    const scalarStops = [
      { stop: 0, output: 5 },
      { stop: 1, output: 6 },
    ];
    expect(resolveScalarStops(scalarParams({ scalarStops }))).toBe(scalarStops);
  });
});

describe('grammarNeedsFeatureValues', () => {
  const stateWith = (scale: any): IGrammarSymbologyState => ({
    layers: [
      {
        id: 'l',
        rules: [
          { id: 'r', fields: ['speed'], mappings: [{ scale, encodings: [] }] },
        ],
      },
    ],
  });

  it('is true for a colorMap with no persisted stops', () => {
    expect(
      grammarNeedsFeatureValues(
        stateWith({ scheme: 'colorMap', params: colorMapParams() }),
      ),
    ).toBe(true);
  });

  it('is false once the colorMap stops are pinned', () => {
    expect(
      grammarNeedsFeatureValues(
        stateWith({
          scheme: 'colorMap',
          params: colorMapParams({
            colorStops: [
              { stop: 0, color: [0, 0, 0, 1] },
              { stop: 1, color: [1, 1, 1, 1] },
            ],
          }),
        }),
      ),
    ).toBe(false);
  });

  it('is false for scales with no data dependency', () => {
    expect(
      grammarNeedsFeatureValues(
        stateWith({ scheme: 'scalar', params: scalarParams() }),
      ),
    ).toBe(false);
  });

  it('is false for an absent state', () => {
    expect(grammarNeedsFeatureValues(undefined)).toBe(false);
  });
});
