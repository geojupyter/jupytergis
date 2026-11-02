jest.mock('geotiff', () => ({ Pool: class {}, fromUrl: jest.fn() }));
jest.mock('ol/style/flat', () => ({}));
jest.mock('@/src/tools', () => ({ objectEntries: Object.entries }));

import { IGrammarSymbologyState, RGBA } from '@jupytergis/schema';

import {
  computeCategorizedColorStops,
  computeGraduatedColorStops,
} from '@/src/features/layers/symbology/styleBuilder';
import {
  DeckColor,
  DeckColorAccessor,
  DeckNumberAccessor,
  grammarToDeckAccessors,
} from '../adapters/deckgl/grammarToDeckAccessors';

function makeState(
  ...rules: IGrammarSymbologyState['layers'][number]['rules']
): IGrammarSymbologyState {
  return {
    layers: [{ id: 'layer', rules }],
  };
}

function constantColor(
  encoding: 'fill-color' | 'stroke-color' | 'circle-fill-color',
  value: [number, number, number, number],
): IGrammarSymbologyState['layers'][number]['rules'][number] {
  return {
    id: `${encoding}-${value.join('-')}`,
    mappings: [
      {
        scale: { scheme: 'constant_rgba', params: { value } },
        encodings: [encoding],
      },
    ],
  };
}

function feature(properties: Record<string, unknown>): {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: null;
} {
  return { type: 'Feature', properties, geometry: null };
}

function paintColor(
  accessor: DeckColorAccessor | undefined,
  properties: Record<string, unknown>,
): DeckColor | undefined {
  if (typeof accessor !== 'function') {
    return accessor;
  }
  return accessor(feature(properties));
}

function paintNumber(
  accessor: DeckNumberAccessor | undefined,
  properties: Record<string, unknown>,
): number | undefined {
  if (typeof accessor !== 'function') {
    return accessor;
  }
  return accessor(feature(properties));
}

function deckColor(rgba: readonly number[]): DeckColor {
  return [rgba[0], rgba[1], rgba[2], Math.round(rgba[3] * 255)];
}

describe('grammarToDeckAccessors', () => {
  it('converts constant fill and stroke, scaling alpha to 0-255', () => {
    const accessors = grammarToDeckAccessors(
      makeState(
        constantColor('fill-color', [255, 0, 0, 1]),
        constantColor('stroke-color', [0, 0, 255, 0.5]),
      ),
    );

    expect(accessors.getFillColor).toEqual([255, 0, 0, 255]);
    expect(accessors.getLineColor).toEqual([0, 0, 255, 128]);
  });

  it('keeps the first constant for each prop', () => {
    const accessors = grammarToDeckAccessors(
      makeState(
        constantColor('fill-color', [1, 2, 3, 1]),
        constantColor('fill-color', [9, 9, 9, 1]),
        constantColor('circle-fill-color', [4, 5, 6, 1]),
      ),
    );

    expect(accessors.getFillColor).toEqual([1, 2, 3, 255]);
    expect(
      grammarToDeckAccessors(
        makeState(constantColor('circle-fill-color', [4, 5, 6, 1])),
      ).getFillColor,
    ).toEqual([4, 5, 6, 255]);
  });

  it('converts constant line width and point radius', () => {
    const accessors = grammarToDeckAccessors(
      makeState({
        id: 'size',
        mappings: [
          {
            scale: { scheme: 'constant_num', params: { value: 2.5 } },
            encodings: ['stroke-width'],
          },
          {
            scale: { scheme: 'constant_num', params: { value: 8 } },
            encodings: ['circle-radius'],
          },
        ],
      }),
    );

    expect(accessors.getLineWidth).toBe(2.5);
    expect(accessors.getPointRadius).toBe(8);
    expect(accessors.getFillColor).toBeUndefined();
  });

  it('interpolates explicit color stops and falls back otherwise', () => {
    const fallback: RGBA = [9, 9, 9, 1];
    const accessors = grammarToDeckAccessors(
      makeState({
        id: 'ramp',
        fields: ['value'],
        mappings: [
          {
            scale: {
              scheme: 'colorMap',
              params: {
                name: 'viridis',
                nShades: 2,
                mode: 'equal interval',
                reverse: false,
                fallback,
                colorStops: [
                  { stop: 0, color: [0, 0, 0, 1] },
                  { stop: 10, color: [100, 0, 0, 1] },
                ],
              },
            },
            encodings: ['fill-color'],
          },
        ],
      }),
    );

    expect(paintColor(accessors.getFillColor, { value: 0 })).toEqual([
      0, 0, 0, 255,
    ]);
    expect(paintColor(accessors.getFillColor, { value: 5 })).toEqual([
      50, 0, 0, 255,
    ]);
    expect(paintColor(accessors.getFillColor, { value: 20 })).toEqual([
      100, 0, 0, 255,
    ]);
    expect(paintColor(accessors.getFillColor, {})).toEqual(deckColor(fallback));
    expect(paintColor(accessors.getFillColor, { value: 'nope' })).toEqual(
      deckColor(fallback),
    );
  });

  it('classifies color stops from feature values', () => {
    const data = {
      type: 'FeatureCollection',
      features: [feature({ value: 0 }), feature({ value: 100 })],
    };
    const params = {
      name: 'viridis',
      nShades: 2,
      mode: 'equal interval' as const,
      reverse: false,
      fallback: [1, 2, 3, 1] as RGBA,
      domain: [0, 100] as [number, number],
    };
    const accessors = grammarToDeckAccessors(
      makeState({
        id: 'classified',
        fields: ['value'],
        mappings: [
          {
            scale: { scheme: 'colorMap', params },
            encodings: ['fill-color'],
          },
        ],
      }),
      data,
    );
    const stops = computeGraduatedColorStops(
      {
        nClasses: params.nShades,
        mode: params.mode,
        colorRamp: params.name,
        reverseRamp: params.reverse,
        vmin: params.domain[0],
        vmax: params.domain[1],
      } as never,
      [0, 100],
    );

    expect(paintColor(accessors.getFillColor, { value: 0 })).toEqual(
      deckColor(stops[0].color),
    );
    expect(
      paintColor(accessors.getFillColor, {
        value: stops.at(-1)?.value as number,
      }),
    ).toEqual(deckColor(stops.at(-1)?.color ?? []));
  });

  it('matches categorical values and falls back on a miss', () => {
    const fallback: RGBA = [1, 1, 1, 1];
    const explicit = grammarToDeckAccessors(
      makeState({
        id: 'categories',
        fields: ['kind'],
        mappings: [
          {
            scale: {
              scheme: 'categorical',
              params: {
                colorRamp: 'viridis',
                fallback,
                colorStops: [
                  { stop: 'a', color: [10, 0, 0, 1] },
                  { stop: 'b', color: [0, 10, 0, 1] },
                ],
              },
            },
            encodings: ['fill-color'],
          },
        ],
      }),
    );

    expect(paintColor(explicit.getFillColor, { kind: 'a' })).toEqual([
      10, 0, 0, 255,
    ]);
    expect(paintColor(explicit.getFillColor, { kind: 'c' })).toEqual(
      deckColor(fallback),
    );

    const data = {
      type: 'FeatureCollection',
      features: [feature({ kind: 'x' }), feature({ kind: 'y' })],
    };
    const classified = grammarToDeckAccessors(
      makeState({
        id: 'classified-categories',
        fields: ['kind'],
        mappings: [
          {
            scale: {
              scheme: 'categorical',
              params: { colorRamp: 'viridis', fallback },
            },
            encodings: ['stroke-color'],
          },
        ],
      }),
      data,
    );
    const stops = computeCategorizedColorStops(
      { colorRamp: 'viridis', reverseRamp: false } as never,
      ['x', 'y'],
    );

    expect(paintColor(classified.getLineColor, { kind: 'x' })).toEqual(
      deckColor(stops[0].color),
    );
    expect(paintColor(classified.getLineColor, { kind: 'missing' })).toEqual(
      deckColor(fallback),
    );
  });

  it('interpolates a scalar domain and uses the fallback when the field is missing', () => {
    const accessors = grammarToDeckAccessors(
      makeState({
        id: 'width',
        fields: ['value'],
        mappings: [
          {
            scale: {
              scheme: 'scalar',
              params: {
                domain: [0, 10],
                range: [2, 12],
                fallback: 1,
                scalarStops: [
                  { stop: 0, output: 2 },
                  { stop: 10, output: 12 },
                ],
              },
            },
            encodings: ['stroke-width'],
          },
          {
            scale: {
              scheme: 'scalar',
              params: {
                domain: [0, 10],
                range: [0, 20],
                fallback: 4,
              },
            },
            encodings: ['circle-radius'],
          },
        ],
      }),
    );

    expect(paintNumber(accessors.getLineWidth, { value: 5 })).toBe(7);
    expect(paintNumber(accessors.getLineWidth, { value: 30 })).toBe(12);
    expect(paintNumber(accessors.getLineWidth, {})).toBe(1);
    expect(paintNumber(accessors.getPointRadius, { value: 5 })).toBe(10);
  });

  it('reads identity colors and numbers from the feature', () => {
    const accessors = grammarToDeckAccessors(
      makeState({
        id: 'identity',
        fields: ['swatch'],
        mappings: [
          {
            scale: { scheme: 'identity' },
            encodings: ['fill-color'],
          },
        ],
      }),
    );
    const radius = grammarToDeckAccessors(
      makeState({
        id: 'identity-radius',
        fields: ['size'],
        mappings: [
          {
            scale: { scheme: 'identity' },
            encodings: ['circle-radius'],
          },
        ],
      }),
    );

    expect(
      paintColor(accessors.getFillColor, { swatch: [8, 16, 32, 0.5] }),
    ).toEqual([8, 16, 32, 128]);
    expect(paintColor(accessors.getFillColor, { swatch: 'red' })).toEqual([
      0, 0, 0, 0,
    ]);
    expect(paintNumber(radius.getPointRadius, { size: 6 })).toBe(6);
    expect(paintNumber(radius.getPointRadius, { size: '6' })).toBe(0);
  });

  it('reads a bare record when the row has no properties bag', () => {
    const rows = [{ value: 0 }, { value: 10 }];
    const accessors = grammarToDeckAccessors(
      makeState({
        id: 'record',
        fields: ['value'],
        mappings: [
          {
            scale: {
              scheme: 'colorMap',
              params: {
                name: 'viridis',
                nShades: 2,
                mode: 'equal interval',
                reverse: false,
                fallback: [0, 0, 0, 1],
                colorStops: [
                  { stop: 0, color: [0, 0, 0, 1] },
                  { stop: 10, color: [80, 0, 0, 1] },
                ],
              },
            },
            encodings: ['fill-color'],
          },
        ],
      }),
      rows,
    );
    const fill = accessors.getFillColor;
    expect(typeof fill).toBe('function');
    if (typeof fill !== 'function') {
      return;
    }

    expect(fill(rows[0])).toEqual([0, 0, 0, 255]);
    expect(fill({ value: 5 })).toEqual([40, 0, 0, 255]);
    expect(fill({ properties: { value: 10 }, value: 0 })).toEqual([
      80, 0, 0, 255,
    ]);
  });

  it('ignores expression scales', () => {
    const accessors = grammarToDeckAccessors(
      makeState({
        id: 'expression',
        fields: ['value'],
        mappings: [
          {
            scale: {
              scheme: 'expression',
              params: { expr: 'datum.value', fallback: [0, 0, 0, 1] },
            },
            encodings: ['fill-color'],
          },
        ],
      }),
    );

    expect(accessors).toEqual({});
  });

  it('returns nothing when symbology is missing', () => {
    expect(grammarToDeckAccessors(undefined)).toEqual({});
    expect(grammarToDeckAccessors({ layers: [] })).toEqual({});
  });
});
