/**
 * Runtime check of the MapLibre translation of a `between` guard, using
 * MapLibre's own expression engine (issue #2025).
 *
 * MapLibre's ordering comparisons throw when the property is missing or null,
 * and a paint expression that throws falls back to the property default
 * (opaque black for colours) instead of the guard's else branch. OL evaluates
 * the same comparison to false. The translation has to make the two agree.
 */

jest.mock('ol/expr/expression', () => ({}));
jest.mock('ol/style/flat', () => ({}));
jest.mock('@jupytergis/schema', () => ({}));
jest.mock('geotiff', () => ({ Pool: class {}, fromUrl: jest.fn() }));
jest.mock('@/src/tools', () => ({ objectEntries: Object.entries }));

import { IGrammarSymbologyState } from '@jupytergis/schema';
import {
  createPropertyExpression,
  latest,
  StylePropertySpecification,
} from '@maplibre/maplibre-gl-style-spec';

import { grammarToMapLibreLayers } from '@/src/mainview/adapters/maplibre/grammerToMLStyle';

const RED = [255, 0, 0, 1];

function betweenState(min: number, max: number): IGrammarSymbologyState {
  return {
    layers: [
      {
        id: 'gl',
        when: [{ type: 'between', field: 'timems', min, max }],
        whenOp: 'all',
        rules: [
          {
            id: 'r',
            mappings: [
              {
                scale: { scheme: 'constant_rgba', params: { value: RED } },
                encodings: ['circle-fill-color'],
              },
            ],
          },
        ],
      },
    ],
  } as unknown as IGrammarSymbologyState;
}

/** Evaluate `circle-color` the way the renderer does, for one feature. */
function circleColorEvaluator(paint: unknown) {
  const spec = (latest.paint_circle as Record<string, unknown>)[
    'circle-color'
  ] as StylePropertySpecification;
  const compiled = createPropertyExpression(paint, 'circle-color', spec);
  if (compiled.result !== 'success') {
    throw new Error(compiled.value.map(e => e.message).join('; '));
  }
  const expression = compiled.value;
  return (properties: Record<string, unknown>) =>
    String(
      expression.evaluate(
        { zoom: 0 } as any,
        { type: 'Point', properties },
        {},
      ),
    );
}

describe('grammarToMapLibreLayers — between guard', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('guards the property type so a missing value is outside the window', () => {
    const [circle] = grammarToMapLibreLayers({
      id: 'layer-1',
      sourceId: 'source-1',
      state: betweenState(10, 20),
      featureValues: [],
      opacity: 1,
      visible: true,
    });

    expect(circle.type).toBe('circle');
    const bound = (op: string, value: number) => [
      'all',
      ['==', ['typeof', ['get', 'timems']], 'number'],
      [op, ['get', 'timems'], value],
    ];
    expect(circle.paint['circle-color']).toEqual([
      'case',
      ['all', bound('>=', 10), bound('<=', 20)],
      'rgba(255, 0, 0, 1)',
      'rgba(0,0,0,0)',
    ]);

    const color = circleColorEvaluator(circle.paint['circle-color']);

    // Inclusive at both ends, hidden outside.
    expect(color({ timems: 10 })).toBe('rgba(255,0,0,1)');
    expect(color({ timems: 15 })).toBe('rgba(255,0,0,1)');
    expect(color({ timems: 20 })).toBe('rgba(255,0,0,1)');
    expect(color({ timems: 9 })).toBe('rgba(0,0,0,0)');
    expect(color({ timems: 21 })).toBe('rgba(0,0,0,0)');

    // No time at all, or one that failed to parse, is outside the window too.
    // Without the type guard these threw and fell back to opaque black.
    expect(color({})).toBe('rgba(0,0,0,0)');
    expect(color({ timems: null })).toBe('rgba(0,0,0,0)');
    expect(color({ timems: NaN })).toBe('rgba(0,0,0,0)');
    expect(warn).not.toHaveBeenCalled();
  });
});
