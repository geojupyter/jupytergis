import { IGrammarSymbologyState, IScale } from '@jupytergis/schema';

import { grammarToDeckAccessors } from '../adapters/deckgl/grammarToDeckAccessors';

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

  it('ignores data-driven scales', () => {
    const scales: IScale[] = [
      {
        scheme: 'colorMap',
        params: {
          name: 'viridis',
          nShades: 5,
          mode: 'equal interval',
          reverse: false,
          fallback: [0, 0, 0, 1],
        },
      },
      {
        scheme: 'categorical',
        params: { colorRamp: 'viridis', fallback: [0, 0, 0, 1] },
      },
      {
        scheme: 'scalar',
        params: {
          domain: [0, 1],
          range: [1, 10],
          fallback: 1,
        },
      },
      { scheme: 'identity' },
      {
        scheme: 'expression',
        params: { expr: 'datum.value', fallback: [0, 0, 0, 1] },
      },
    ];

    for (const scale of scales) {
      const accessors = grammarToDeckAccessors(
        makeState({
          id: scale.scheme,
          fields: ['value'],
          mappings: [{ scale, encodings: ['fill-color'] }],
        }),
      );
      expect(accessors).toEqual({});
    }
  });

  it('returns nothing when symbology is missing', () => {
    expect(grammarToDeckAccessors(undefined)).toEqual({});
    expect(grammarToDeckAccessors({ layers: [] })).toEqual({});
  });
});
