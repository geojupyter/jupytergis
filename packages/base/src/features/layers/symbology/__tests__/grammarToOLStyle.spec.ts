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

import {
  extractEncodingFieldValues,
  grammarToOLStyle,
} from '../grammarToOLStyle';

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
// OL runtime tests — use the real OL expression parser/evaluator
// ---------------------------------------------------------------------------
// These tests cover geojupyter/jupytergis#1417: real OL library used so the
// compiled expressions are validated at the parser/evaluator level, not just
// as plain JS objects.  jest.base.js must include 'ol' in transformIgnorePatterns
// for these to work.

describe('grammarToOLStyle — OL runtime parsing', () => {
  let parse: (encoded: unknown, type: number, ctx: unknown) => unknown;
  let newParsingContext: () => unknown;
  let ColorType: number;

  beforeAll(() => {
    const actual = jest.requireActual('ol/expr/expression');
    parse = actual.parse;
    newParsingContext = actual.newParsingContext;
    ColorType = actual.ColorType;
  });

  it('categorical case expression compiled from featureValues parses natively', () => {
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        fields: ['type'],
        mappings: [
          {
            scale: {
              scheme: 'categorical',
              params: {
                colorRamp: 'schemeCategory10',
                fallback: [0, 0, 0, 0] as [number, number, number, number],
              },
            },
            channels: ['fill-color'],
          },
        ],
      }),
      ['road', 'river', 'lake'],
    ) as any;
    expect(() =>
      parse(style['fill-color'], ColorType, newParsingContext()),
    ).not.toThrow();
  });

  it('colorRamp interpolate expression compiled from featureValues parses natively', () => {
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
                fallback: [0, 0, 0, 0] as [number, number, number, number],
              },
            },
            channels: ['fill-color'],
          },
        ],
      }),
      [0, 25, 50, 75, 100],
    ) as any;
    expect(() =>
      parse(style['fill-color'], ColorType, newParsingContext()),
    ).not.toThrow();
  });
});

describe('grammarToOLStyle — OL runtime evaluation', () => {
  let buildExpression: (
    encoded: unknown,
    type: number,
    ctx: unknown,
  ) => (evalCtx: Record<string, unknown>) => unknown;
  let newEvalCtx: () => {
    properties: Record<string, unknown>;
    variables: Record<string, unknown>;
    resolution: number;
    featureId: unknown;
    geometryType: string;
  };
  let newParseCtx: () => unknown;
  let ColorType: number;

  beforeAll(() => {
    jest.unmock('ol/expr/expression');
    const expr = jest.requireActual('ol/expr/expression');
    const cpu = jest.requireActual('ol/expr/cpu');
    buildExpression = cpu.buildExpression;
    newEvalCtx = cpu.newEvaluationContext;
    newParseCtx = expr.newParsingContext;
    ColorType = expr.ColorType;
  });

  function evaluate(
    encoded: any,
    type: number,
    props: Record<string, unknown>,
  ) {
    const evaluator = buildExpression(encoded, type, newParseCtx());
    const ctx = newEvalCtx();
    ctx.properties = props;
    return evaluator(ctx);
  }

  it('categorical case expression routes each value to the correct color', () => {
    // Hand-built case expression as compileCategorical would produce it.
    const expr = [
      'case',
      ['==', ['get', 'type'], 'road'],
      [255, 0, 0, 1],
      ['==', ['get', 'type'], 'river'],
      [0, 0, 255, 1],
      [0, 0, 0, 0], // fallback
    ];
    expect(evaluate(expr, ColorType, { type: 'road' })).toEqual([255, 0, 0, 1]);
    expect(evaluate(expr, ColorType, { type: 'river' })).toEqual([
      0, 0, 255, 1,
    ]);
    expect(evaluate(expr, ColorType, { type: 'other' })).toEqual([0, 0, 0, 0]);
  });

  it('categorical null stop parses and evaluates for null, undefined, and missing', () => {
    const nullColor = [255, 0, 255, 1] as [number, number, number, number];
    const roadColor = [255, 0, 0, 1] as [number, number, number, number];
    const fallback = [0, 0, 0, 0] as [number, number, number, number];

    const style = grammarToOLStyle(
      makeState({
        id: '1',
        fields: ['type'],
        mappings: [
          {
            scale: {
              scheme: 'categorical',
              params: {
                colorRamp: 'schemeCategory10',
                fallback,
                colorStops: [
                  { stop: 'road', color: roadColor },
                  { stop: null, color: nullColor },
                ],
              },
            },
            channels: ['fill-color'],
          },
        ],
      }),
    ) as any;

    // Matched value → road color
    expect(evaluate(style['fill-color'], ColorType, { type: 'road' })).toEqual(
      roadColor,
    );
    // Missing property → null color
    expect(evaluate(style['fill-color'], ColorType, {})).toEqual(nullColor);
    // Explicit null → null color
    expect(evaluate(style['fill-color'], ColorType, { type: null })).toEqual(
      nullColor,
    );
    // Explicit undefined → null color
    expect(
      evaluate(style['fill-color'], ColorType, { type: undefined }),
    ).toEqual(nullColor);
    // Unmatched value → fallback
    expect(evaluate(style['fill-color'], ColorType, { type: 'river' })).toEqual(
      fallback,
    );
  });

  it('cycled categorical expression routes 11th value to same color as 1st', () => {
    // schemeCategory10 has 10 colors; with 12 unique values the 11th and 12th
    // must cycle back to palette[0] and palette[1].  This test would fail
    // before the hex-color fix in generateColors (geojupyter/jupytergis#1415)
    // because all colors were parsed as DEFAULT_COLOR, making all 12 equal.
    const style = grammarToOLStyle(
      makeState({
        id: '1',
        fields: ['cat'],
        mappings: [
          {
            scale: {
              scheme: 'categorical',
              params: {
                colorRamp: 'schemeCategory10',
                fallback: [0, 0, 0, 0] as [number, number, number, number],
              },
            },
            channels: ['fill-color'],
          },
        ],
      }),
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'],
    ) as any;

    const color_a = evaluate(style['fill-color'], ColorType, { cat: 'a' });
    const color_b = evaluate(style['fill-color'], ColorType, { cat: 'b' });
    const color_k = evaluate(style['fill-color'], ColorType, { cat: 'k' });
    const color_l = evaluate(style['fill-color'], ColorType, { cat: 'l' });

    // 11th value ('k') cycles back to palette[0] → same color as 'a'
    expect(color_k).toEqual(color_a);
    // 12th value ('l') cycles back to palette[1] → same color as 'b'
    expect(color_l).toEqual(color_b);
    // First two palette colors must be distinct (palette is not degenerate)
    expect(color_a).not.toEqual(color_b);
  });
});

describe('extractEncodingFieldValues', () => {
  const rows = [
    { type: 'road', lanes: 2, length: 100 },
    { type: 'river', lanes: 0, length: 500 },
    { type: 'lake', lanes: 0, length: 200 },
  ];

  const stateWithField = makeState({
    id: '1',
    fields: ['type'],
    mappings: [
      {
        scale: {
          scheme: 'categorical',
          params: { colorRamp: 'schemeCategory10', fallback: [0, 0, 0, 0] },
        },
        channels: ['fill-color'],
      },
    ],
  });

  it('returns only the values for the encoding field', () => {
    expect(extractEncodingFieldValues(stateWithField, rows)).toEqual([
      'road',
      'river',
      'lake',
    ]);
  });

  it('categorical scale with field-specific values produces the correct branch count', () => {
    const values = extractEncodingFieldValues(stateWithField, rows);
    const style = grammarToOLStyle(stateWithField, values) as any;
    // ['case', c1,v1, c2,v2, c3,v3, fallback] — 3 branches, not 8
    expect(style['fill-color'].length).toBe(1 + 2 * 3 + 1);
  });

  it('returns empty array when no named field is in the state', () => {
    const fieldlessState = makeState({
      id: '1',
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
    });
    expect(extractEncodingFieldValues(fieldlessState, rows)).toEqual([]);
  });
});
