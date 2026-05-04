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
jest.mock('../tiff_layer/types/SingleBandPseudoColor', () => ({}));
jest.mock('@/src/tools', () => ({ objectEntries: Object.entries }));

import { grammarToOLStyle } from '../grammar/grammarToOLStyle';
import { IGrammarSymbologyState } from '../grammar/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(
  ...rules: IGrammarSymbologyState['rules']
): IGrammarSymbologyState {
  return { renderType: 'Grammar', rules };
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
            outputType: 'rgba',
            scale: { scheme: 'constant', value: [255, 0, 0, 1] },
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
            outputType: 'posfloat',
            scale: { scheme: 'constant', value: 3 },
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
            outputType: 'rgba',
            scale: { scheme: 'constant', value: [0, 128, 255, 1] },
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
            outputType: 'rgba',
            scale: { scheme: 'constant', value: [255, 0, 0, 1] },
            channels: ['fill-color'],
          },
          {
            outputType: 'posfloat',
            scale: { scheme: 'constant', value: 2 },
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
            outputType: 'uint8',
            scale: { scheme: 'constant', value: 255 },
            channels: ['fill-red'],
          },
          {
            outputType: 'uint8',
            scale: { scheme: 'constant', value: 0 },
            channels: ['fill-green', 'fill-blue'],
          },
          {
            outputType: 'unorm',
            scale: { scheme: 'constant', value: 1 },
            channels: ['fill-alpha'],
          },
        ],
      }),
    );
    expect(style['fill-color']).toEqual(['array', 255, 0, 0, 1]);
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
            outputType: 'uint8',
            scale: { scheme: 'constant', value: 128 },
            channels: ['fill-red'],
          },
        ],
      }),
    );
    // green, blue default to 0; alpha defaults to 1
    expect(style['fill-color']).toEqual(['array', 128, 0, 0, 1]);
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
            outputType: 'rgba',
            scale: { scheme: 'constant', value: [255, 0, 0, 1] },
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
            outputType: 'rgba',
            scale: { scheme: 'constant', value: [0, 0, 0, 1] },
            channels: ['stroke-color'],
          },
        ],
      }),
    ) as any;
    expect(style['stroke-color'][1]).toEqual([
      '==',
      ['get', 'type'],
      'road',
    ]);
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
            outputType: 'rgba',
            scale: { scheme: 'constant', value: [255, 0, 0, 1] },
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
              outputType: 'rgba',
              scale: { scheme: 'constant', value: [255, 0, 0, 1] },
              channels: ['fill-color'],
            },
          ],
        },
        {
          id: '2',
          mappings: [
            {
              outputType: 'rgba',
              scale: { scheme: 'constant', value: [0, 255, 0, 1] },
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
