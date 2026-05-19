/**
 * Unit tests for grammarToOLStyle — compiler-specific behaviour not covered
 * by the parity tests (which only verify equivalence with the old builder).
 *
 * Tests here cover Grammar-only features:
 *   - when-predicate guards
 *   - fan-out (one mapping → multiple channels)
 *   - sub-channel assembly (fill-red/green/blue/alpha → fill-color array)
 *   - constant and identity scales
 *   - multiple rules on the same channel (last unconditional wins)
 */

jest.mock('ol/expr/expression', () => ({}));
jest.mock('ol/style/flat', () => ({}));
jest.mock('@jupytergis/schema', () => ({}));
jest.mock('geotiff', () => ({ Pool: class {}, fromUrl: jest.fn() }));
jest.mock('@/src/tools', () => ({ objectEntries: Object.entries }));

import { IGrammarSymbologyState } from '@jupytergis/schema';

import { grammarToOLStyle } from '../grammarToOLStyle';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(
  ...rules: IGrammarSymbologyState['layers'][number]['rules']
): IGrammarSymbologyState {
  return {
    layers: [{ id: 'test-layer', rules }],
  };
}

// ---------------------------------------------------------------------------
// Constant scale
// ---------------------------------------------------------------------------

describe('grammarToOLStyle — constant scale', () => {
  it('outputs the literal RGBA value on the target channel', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        mappings: [
          {
            scale: {
              scheme: 'constant_rgba',
              params: { value: [255, 0, 0, 1] },
            },
            channels: ['fill-color'],
          },
        ],
      }),
    );
    expect(style['fill-color']).toEqual([255, 0, 0, 1]);
  });

  it('outputs a literal number on a numeric channel', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        mappings: [
          {
            scale: { scheme: 'constant_num', params: { value: 3 } },
            channels: ['stroke-width'],
          },
        ],
      }),
    );
    expect(style['stroke-width']).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Fan-out — one mapping targeting multiple channels
// ---------------------------------------------------------------------------

describe('grammarToOLStyle — fan-out', () => {
  it('writes the same expression to all listed channels', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        mappings: [
          {
            scale: {
              scheme: 'constant_rgba',
              params: { value: [0, 128, 255, 1] },
            },
            channels: ['fill-color', 'stroke-color', 'circle-fill-color'],
          },
        ],
      }),
    );
    expect(style['fill-color']).toEqual([0, 128, 255, 1]);
    expect(style['stroke-color']).toEqual([0, 128, 255, 1]);
    expect(style['circle-fill-color']).toEqual([0, 128, 255, 1]);
  });

  it('supports mixed output types in one rule via multiple mappings', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        mappings: [
          {
            scale: {
              scheme: 'constant_rgba',
              params: { value: [255, 0, 0, 1] },
            },
            channels: ['fill-color'],
          },
          {
            scale: { scheme: 'constant_num', params: { value: 2 } },
            channels: ['stroke-width', 'circle-stroke-width'],
          },
        ],
      }),
    );
    expect(style['fill-color']).toEqual([255, 0, 0, 1]);
    expect(style['stroke-width']).toBe(2);
    expect(style['circle-stroke-width']).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Sub-channel assembly
// ---------------------------------------------------------------------------

describe('grammarToOLStyle — sub-channel assembly', () => {
  it('assembles fill-red/green/blue/alpha into fill-color array expression', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        mappings: [
          {
            scale: { scheme: 'constant_num', params: { value: 255 } },
            channels: ['fill-red'],
          },
          {
            scale: { scheme: 'constant_num', params: { value: 0 } },
            channels: ['fill-green', 'fill-blue'],
          },
          {
            scale: { scheme: 'constant_num', params: { value: 1 } },
            channels: ['fill-alpha'],
          },
        ],
      }),
    );
    expect(style['fill-color']).toEqual(['color', 255, 0, 0, 1]);
    // Sub-channels should not appear as top-level keys
    expect(style['fill-red']).toBeUndefined();
    expect(style['fill-green']).toBeUndefined();
    expect(style['fill-blue']).toBeUndefined();
    expect(style['fill-alpha']).toBeUndefined();
  });

  it('defaults missing sub-channels to 0 (and alpha to 1)', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        mappings: [
          {
            scale: { scheme: 'constant_num', params: { value: 128 } },
            channels: ['fill-red'],
          },
        ],
      }),
    );
    // green, blue default to 0; alpha defaults to 1
    expect(style['fill-color']).toEqual(['color', 128, 0, 0, 1]);
  });
});

// ---------------------------------------------------------------------------
// When-predicate guards
// ---------------------------------------------------------------------------

describe('grammarToOLStyle — when predicates', () => {
  it('wraps the expression in a case for a geometryType predicate', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        when: [{ type: 'geometryType', value: 'Point' }],
        mappings: [
          {
            scale: {
              scheme: 'constant_rgba',
              params: { value: [255, 0, 0, 1] },
            },
            channels: ['fill-color'],
          },
        ],
      }),
    ) as any;
    expect(style['fill-color'][0]).toBe('case');
    expect(style['fill-color'][1]).toEqual(['==', ['geometry-type'], 'Point']);
    expect(style['fill-color'][2]).toEqual([255, 0, 0, 1]);
  });

  it('uses fieldEquals predicate correctly', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        when: [{ type: 'fieldEquals', field: 'type', value: 'road' }],
        mappings: [
          {
            scale: { scheme: 'constant_rgba', params: { value: [0, 0, 0, 1] } },
            channels: ['stroke-color'],
          },
        ],
      }),
    ) as any;
    expect(style['stroke-color'][1]).toEqual(['==', ['get', 'type'], 'road']);
  });

  it('ANDs multiple predicates with all', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        when: [
          { type: 'geometryType', value: 'Point' },
          { type: 'hasField', field: 'name' },
        ],
        mappings: [
          {
            scale: {
              scheme: 'constant_rgba',
              params: { value: [255, 0, 0, 1] },
            },
            channels: ['fill-color'],
          },
        ],
      }),
    ) as any;
    expect(style['fill-color'][1][0]).toBe('all');
  });

  it('last unconditional rule wins when mixed with conditional', () => {
    const style = grammarToOLStyle(
      makeState(
        {
          id: '1',
          when: [{ type: 'geometryType', value: 'Point' }],
          mappings: [
            {
              scale: {
                scheme: 'constant_rgba',
                params: { value: [255, 0, 0, 1] },
              },
              channels: ['fill-color'],
            },
          ],
        },
        {
          id: '2',
          mappings: [
            {
              scale: {
                scheme: 'constant_rgba',
                params: { value: [0, 255, 0, 1] },
              },
              channels: ['fill-color'],
            },
          ],
        },
      ),
    ) as any;
    // case expression: [guard, expr, else]
    expect(style['fill-color'][0]).toBe('case');
    // else branch is the unconditional rule
    expect(style['fill-color'][3]).toEqual([0, 255, 0, 1]);
  });
});

// ---------------------------------------------------------------------------
// colorRamp scale
// ---------------------------------------------------------------------------

describe('grammarToOLStyle — colorRamp scale', () => {
  it('emits channelZero when no field and no stops', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        mappings: [
          {
            scale: {
              scheme: 'colorRamp',
              params: {
                name: 'viridis',
                nShades: 5,
                mode: 'equal interval',
                reverse: false,
                fallback: [0, 0, 0, 0],
              },
            },
            channels: ['fill-color'],
          },
        ],
      }),
    );
    // No field → fallback value
    expect(style['fill-color']).toEqual([0, 0, 0, 0]);
  });

  it('emits a case/interpolate expression when field and feature values are provided', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        fields: ['elevation'],
        mappings: [
          {
            scale: {
              scheme: 'colorRamp',
              params: {
                name: 'viridis',
                nShades: 3,
                mode: 'equal interval',
                reverse: false,
                fallback: [0, 0, 0, 0],
              },
            },
            channels: ['fill-color'],
          },
        ],
      }),
      [0, 50, 100],
    ) as any;
    expect(style['fill-color'][0]).toBe('case');
    expect(style['fill-color'][1]).toEqual(['has', 'elevation']);
    // interpolate expression
    expect(style['fill-color'][2][0]).toBe('interpolate');
    expect(style['fill-color'][2][2]).toEqual(['get', 'elevation']);
  });

  it('uses explicit colorStops when provided', () => {
    const stops = [
      { stop: 0, color: [0, 0, 255, 1] as [number, number, number, number] },
      { stop: 100, color: [255, 0, 0, 1] as [number, number, number, number] },
    ];
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        fields: ['elevation'],
        mappings: [
          {
            scale: {
              scheme: 'colorRamp',
              params: {
                name: 'viridis',
                nShades: 5,
                mode: 'equal interval',
                reverse: false,
                fallback: [0, 0, 0, 0],
                colorStops: stops,
              },
            },
            channels: ['fill-color'],
          },
        ],
      }),
    ) as any;
    const interpolate = style['fill-color'][2];
    expect(interpolate[0]).toBe('interpolate');
    // stops interleaved: stop_value, color, stop_value, color
    expect(interpolate[3]).toBe(0);
    expect(interpolate[4]).toEqual([0, 0, 255, 1]);
    expect(interpolate[5]).toBe(100);
    expect(interpolate[6]).toEqual([255, 0, 0, 1]);
  });
});

// ---------------------------------------------------------------------------
// categorical scale
// ---------------------------------------------------------------------------

describe('grammarToOLStyle — categorical scale', () => {
  it('emits fallback when no field', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        mappings: [
          {
            scale: {
              scheme: 'categorical',
              params: { colorRamp: 'viridis', fallback: [0, 0, 0, 0] },
            },
            channels: ['fill-color'],
          },
        ],
      }),
    );
    expect(style['fill-color']).toEqual([0, 0, 0, 0]);
  });

  it('emits a case expression from explicit colorStops', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        fields: ['type'],
        mappings: [
          {
            scale: {
              scheme: 'categorical',
              params: {
                colorRamp: 'viridis',
                fallback: [0, 0, 0, 0],
                colorStops: [
                  {
                    stop: 'road',
                    color: [255, 0, 0, 1] as [number, number, number, number],
                  },
                  {
                    stop: 'river',
                    color: [0, 0, 255, 1] as [number, number, number, number],
                  },
                ],
              },
            },
            channels: ['fill-color'],
          },
        ],
      }),
    ) as any;
    expect(style['fill-color'][0]).toBe('case');
    // first condition: ['==', ['get', 'type'], 'road']
    expect(style['fill-color'][1]).toEqual(['==', ['get', 'type'], 'road']);
    expect(style['fill-color'][2]).toEqual([255, 0, 0, 1]);
    // fallback at end
    expect(style['fill-color'][5]).toEqual([0, 0, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// scalar scale
// ---------------------------------------------------------------------------

describe('grammarToOLStyle — scalar scale', () => {
  it('emits fallback when no field', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        mappings: [
          {
            scale: {
              scheme: 'scalar',
              params: {
                domain: [0, 100],
                range: [1, 20],
                mode: 'equal interval',
                nStops: 3,
                fallback: 5,
              },
            },
            channels: ['stroke-width'],
          },
        ],
      }),
    );
    expect(style['stroke-width']).toBe(5);
  });

  it('emits an interpolate expression when field is provided', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        fields: ['population'],
        mappings: [
          {
            scale: {
              scheme: 'scalar',
              params: {
                domain: [0, 100],
                range: [1, 10],
                mode: 'equal interval',
                nStops: 2,
                fallback: 1,
              },
            },
            channels: ['circle-radius'],
          },
        ],
      }),
    ) as any;
    expect(style['circle-radius'][0]).toBe('case');
    expect(style['circle-radius'][1]).toEqual(['has', 'population']);
    expect(style['circle-radius'][2][0]).toBe('interpolate');
    expect(style['circle-radius'][2][2]).toEqual(['get', 'population']);
  });
});

// ---------------------------------------------------------------------------
// identity scale
// ---------------------------------------------------------------------------

describe('grammarToOLStyle — identity scale', () => {
  it('emits coalesce(get(field), fallback) for a color channel', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        fields: ['color'],
        mappings: [{ scale: { scheme: 'identity' }, channels: ['fill-color'] }],
      }),
    ) as any;
    expect(style['fill-color'][0]).toBe('coalesce');
    expect(style['fill-color'][1]).toEqual(['get', 'color']);
    // fallback is a transparent color array
    expect(style['fill-color'][2]).toEqual([0, 0, 0, 0]);
  });

  it('emits coalesce(get(field), 0) for a numeric channel', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        fields: ['width'],
        mappings: [
          { scale: { scheme: 'identity' }, channels: ['stroke-width'] },
        ],
      }),
    ) as any;
    expect(style['stroke-width'][0]).toBe('coalesce');
    expect(style['stroke-width'][1]).toEqual(['get', 'width']);
    expect(style['stroke-width'][2]).toBe(0);
  });

  it('emits channelZero when no field is set', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        mappings: [{ scale: { scheme: 'identity' }, channels: ['fill-color'] }],
      }),
    );
    expect(style['fill-color']).toBe('rgba(0,0,0,0)');
  });
});

// ---------------------------------------------------------------------------
// OL runtime validation — ensures compiled expressions parse in real OL
// ---------------------------------------------------------------------------

describe('grammarToOLStyle — OL runtime parsing', () => {
  let parse: (
    encoded: unknown,
    expectedType: number,
    context: unknown,
  ) => unknown;
  let newParsingContext: () => unknown;
  let NumberType: number;
  let ColorType: number;

  beforeAll(() => {
    const actual = jest.requireActual('ol/expr/expression');
    parse = actual.parse;
    newParsingContext = actual.newParsingContext;
    NumberType = actual.NumberType;
    ColorType = actual.ColorType;
  });

  it('compileBinFieldExpr case expression parses natively', () => {
    // Emulates: bins=2, field='mag', values=[1,2,3,4]
    const expr = [
      'case',
      ['between', ['get', 'mag'], 1, 2.5],
      1.75,
      ['between', ['get', 'mag'], 2.5, 5],
      3.75,
      3.75, // fallback
    ];
    expect(() => parse(expr, NumberType, newParsingContext())).not.toThrow();
  });

  it('compileBinFieldExpr with 20 bins parses natively', () => {
    // Replicate the expression compileBinFieldExpr would produce for 20 bins
    const field = 'mag';
    const bins = 20;
    const vals = Array.from({ length: 100 }, (_, i) => i + 1);
    const numeric = vals.map(Number).filter(v => !isNaN(v));
    const min = Math.min(...numeric);
    const max = Math.max(...numeric);
    const binWidth = (max - min) / bins;

    const parts: any[] = [];
    let lastCenter = 0;
    for (let i = 0; i < bins; i++) {
      const lo = min + i * binWidth;
      const hi = min + (i + 1) * binWidth;
      const center = Math.round((lo + binWidth / 2) * 1e9) / 1e9;
      lastCenter = center;
      parts.push(
        ['between', ['get', field], lo, i === bins - 1 ? max + 1 : hi],
        center,
      );
    }
    const expr = ['case', ...parts, lastCenter];
    expect(() => parse(expr, NumberType, newParsingContext())).not.toThrow();
  });

  it('interpolate wrapping compileBinFieldExpr output parses naturally', () => {
    const field = 'mag';
    const bins = 20;
    const vals = Array.from({ length: 100 }, (_, i) => i + 1);
    const numeric = vals.map(Number).filter(v => !isNaN(v));
    const min = Math.min(...numeric);
    const max = Math.max(...numeric);
    const binWidth = (max - min) / bins;

    const parts: any[] = [];
    let lastCenter = 0;
    for (let i = 0; i < bins; i++) {
      const lo = min + i * binWidth;
      const hi = min + (i + 1) * binWidth;
      const center = Math.round((lo + binWidth / 2) * 1e9) / 1e9;
      lastCenter = center;
      parts.push(
        ['between', ['get', field], lo, i === bins - 1 ? max + 1 : hi],
        center,
      );
    }
    const binExpr = ['case', ...parts, lastCenter];

    // Simulate what compileColorRamp produces
    const interpExpr: any[] = ['interpolate', ['linear'], binExpr];
    for (let i = 0; i < 9; i++) {
      interpExpr.push(i * 10, [i * 25, i * 25, i * 25, 1]);
    }
    const wrapped = ['case', ['has', field], interpExpr, [0, 0, 0, 0]];

    // Parse with ColorType — the wrapped expression returns a color
    expect(() => parse(wrapped, ColorType, newParsingContext())).not.toThrow();
  });

  it('grammarToOLStyle bin output on numeric channel parses', () => {
    // Validates the full pipeline: $binned → identity → stroke-width
    const state: IGrammarSymbologyState = {
      layers: [
        {
          id: 'L1',
          preprocess: [{ type: 'bin', field: 'mag', bins: 5 }] as any,
          rules: [
            {
              id: 'r1',
              fields: ['$binned'],
              mappings: [
                { scale: { scheme: 'identity' }, channels: ['stroke-width'] },
              ],
            },
          ],
        },
      ],
    };
    const style = grammarToOLStyle(state, [1, 2, 3, 4, 5]) as any;
    // stroke-width expression should be a coalesce wrapping the bin case
    expect(style['stroke-width']).toBeDefined();
    expect(style['stroke-width'][0]).toBe('coalesce');
    expect(style['stroke-width'][1][0]).toBe('case');
    expect(() =>
      parse(style['stroke-width'], NumberType, newParsingContext()),
    ).not.toThrow();
  });
});
