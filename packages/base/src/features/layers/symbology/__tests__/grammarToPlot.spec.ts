/**
 * Unit tests for grammarToPlotSpec — compiler converts grammar symbology
 * state into a Vega-Lite top-level spec.
 */

import { IGrammarSymbologyState } from '@jupytergis/schema';

import { compilePlot, grammarToPlotSpec } from '../grammarToPlot';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLayer(
  ...rules: IGrammarSymbologyState['layers'][number]['rules']
): IGrammarSymbologyState {
  return { layers: [{ id: 'test-layer', rules }] };
}

function rule(
  overrides: Partial<
    IGrammarSymbologyState['layers'][number]['rules'][number]
  > = {},
): IGrammarSymbologyState['layers'][number]['rules'][number] {
  return {
    id: 'r1',
    fields: ['pop'],
    mappings: [
      {
        scale: { scheme: 'identity' },
        channels: ['plot-x'],
      },
    ],
    ...overrides,
  } as any;
}

// ---------------------------------------------------------------------------
// Null / empty cases
// ---------------------------------------------------------------------------

describe('grammarToPlotSpec — null/empty', () => {
  it('returns null for undefined state', () => {
    expect(grammarToPlotSpec(undefined)).toBeNull();
  });

  it('returns null for state with no layers', () => {
    expect(grammarToPlotSpec({ layers: [] })).toBeNull();
  });

  it('returns null when no rules have plot channels', () => {
    const state = makeLayer({
      id: 'r1',
      mappings: [
        {
          scale: { scheme: 'constant_rgba', params: { value: [255, 0, 0, 1] } },
          channels: ['fill-color'],
        },
      ],
    });
    expect(grammarToPlotSpec(state)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Basic encoding
// ---------------------------------------------------------------------------

describe('grammarToPlotSpec — basic encoding', () => {
  it('maps plot-x and plot-y with identity scale', () => {
    const state = {
      layers: [
        {
          id: 'L1',
          rules: [
            {
              id: 'r1',
              fields: ['mag'],
              mappings: [
                { scale: { scheme: 'identity' }, channels: ['plot-x'] },
              ],
            },
            {
              id: 'r2',
              fields: ['depth'],
              mappings: [
                { scale: { scheme: 'identity' }, channels: ['plot-y'] },
              ],
            },
          ],
        },
      ],
    } as IGrammarSymbologyState;

    const spec = grammarToPlotSpec(state);
    expect(spec).not.toBeNull();
    expect(spec!.mark).toBe('point');
    expect(spec!.encoding).toEqual({
      x: { field: 'mag', type: 'quantitative' },
      y: { field: 'depth', type: 'quantitative' },
    });
  });

  it('respects the mark parameter', () => {
    const state = makeLayer(rule());
    const spec = grammarToPlotSpec(state, 'bar');
    expect(spec!.mark).toBe('bar');
  });

  it('defaults mark to point', () => {
    const state = makeLayer(rule());
    expect(grammarToPlotSpec(state)!.mark).toBe('point');
  });
});

// ---------------------------------------------------------------------------
// Scale types
// ---------------------------------------------------------------------------

describe('grammarToPlotSpec — scale types', () => {
  it('maps colorRamp to Vega-Lite color with scheme', () => {
    const state = makeLayer({
      id: 'r1',
      fields: ['mag'],
      mappings: [
        {
          scale: {
            scheme: 'colorRamp',
            params: {
              name: 'viridis',
              nShades: 9,
              mode: 'equal interval',
              reverse: false,
              fallback: [0, 0, 0, 0],
            },
          },
          channels: ['plot-color'],
        },
      ],
    });

    const spec = grammarToPlotSpec(state);
    expect(spec!.encoding.color).toEqual({
      field: 'mag',
      type: 'quantitative',
      scale: { scheme: 'viridis' },
      legend: true,
    });
  });

  it('maps categorical to Vega-Lite nominal color', () => {
    const state = makeLayer({
      id: 'r1',
      fields: ['type'],
      mappings: [
        {
          scale: {
            scheme: 'categorical',
            params: { colorRamp: 'Set3', fallback: [0, 0, 0, 0] },
          },
          channels: ['plot-color'],
        },
      ],
    });

    const spec = grammarToPlotSpec(state);
    expect(spec!.encoding.color).toEqual({
      field: 'type',
      type: 'nominal',
      legend: true,
    });
  });

  it('maps scalar to quantitative encoding with domain/range', () => {
    const state = makeLayer({
      id: 'r1',
      fields: ['mag'],
      mappings: [
        {
          scale: {
            scheme: 'scalar',
            params: {
              domain: [0, 100],
              range: [1, 20],
              mode: 'equal interval',
              nStops: 5,
              fallback: 1,
            },
          },
          channels: ['plot-x'],
        },
      ],
    });

    const spec = grammarToPlotSpec(state);
    expect(spec!.encoding.x).toEqual({
      field: 'mag',
      type: 'quantitative',
      scale: { domain: [0, 100], range: [1, 20] },
    });
  });

  it('maps constant_rgba to literal color value', () => {
    const state = makeLayer({
      id: 'r1',
      mappings: [
        {
          scale: {
            scheme: 'constant_rgba',
            params: { value: [255, 128, 0, 1] },
          },
          channels: ['plot-color'],
        },
      ],
    });

    const spec = grammarToPlotSpec(state);
    expect(spec!.encoding.color).toEqual({
      value: 'rgba(255,128,0,1)',
    });
  });

  it('maps constant_num to literal value', () => {
    const state = makeLayer({
      id: 'r1',
      mappings: [
        {
          scale: { scheme: 'constant_num', params: { value: 42 } },
          channels: ['plot-x'],
        },
      ],
    });

    const spec = grammarToPlotSpec(state);
    expect(spec!.encoding.x).toEqual({ value: 42 });
  });
});

// ---------------------------------------------------------------------------
// Channel merging and last-write-wins
// ---------------------------------------------------------------------------

describe('grammarToPlotSpec — channel merging', () => {
  it('combines channels from multiple rules into one encoding', () => {
    const state = makeLayer(
      {
        id: 'r1',
        fields: ['mag'],
        mappings: [{ scale: { scheme: 'identity' }, channels: ['plot-x'] }],
      },
      {
        id: 'r2',
        fields: ['depth'],
        mappings: [{ scale: { scheme: 'identity' }, channels: ['plot-y'] }],
      },
      {
        id: 'r3',
        fields: ['mag'],
        mappings: [
          {
            scale: {
              scheme: 'colorRamp',
              params: {
                name: 'viridis',
                nShades: 9,
                mode: 'equal interval',
                reverse: false,
                fallback: [0, 0, 0, 0],
              },
            },
            channels: ['plot-color'],
          },
        ],
      },
    );

    const spec = grammarToPlotSpec(state);
    expect(Object.keys(spec!.encoding)).toEqual(['x', 'y', 'color']);
  });

  it('last rule wins for duplicate plot channels', () => {
    const state = makeLayer(
      {
        id: 'r1',
        fields: ['mag'],
        mappings: [{ scale: { scheme: 'identity' }, channels: ['plot-x'] }],
      },
      {
        id: 'r2',
        fields: ['depth'],
        mappings: [{ scale: { scheme: 'identity' }, channels: ['plot-x'] }],
      },
    );

    const spec = grammarToPlotSpec(state);
    expect(spec!.encoding.x).toEqual({
      field: 'depth',
      type: 'quantitative',
    });
  });

  it('fan-out: one field mapped to multiple plot channels', () => {
    const state = makeLayer({
      id: 'r1',
      fields: ['mag'],
      mappings: [
        {
          scale: { scheme: 'identity' },
          channels: ['plot-x', 'plot-y'],
        },
        {
          scale: {
            scheme: 'colorRamp',
            params: {
              name: 'magma',
              nShades: 9,
              mode: 'equal interval',
              reverse: false,
              fallback: [0, 0, 0, 0],
            },
          },
          channels: ['plot-color'],
        },
      ],
    });

    const spec = grammarToPlotSpec(state);
    expect(spec!.encoding.x).toEqual({ field: 'mag', type: 'quantitative' });
    expect(spec!.encoding.y).toEqual({ field: 'mag', type: 'quantitative' });
    expect(spec!.encoding.color).toEqual({
      field: 'mag',
      type: 'quantitative',
      scale: { scheme: 'magma' },
      legend: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Multiple layers
// ---------------------------------------------------------------------------

describe('grammarToPlotSpec — multiple layers', () => {
  it('merges plot channels across layers', () => {
    const state: IGrammarSymbologyState = {
      layers: [
        {
          id: 'L1',
          rules: [
            {
              id: 'r1',
              fields: ['mag'],
              mappings: [
                { scale: { scheme: 'identity' }, channels: ['plot-x'] },
              ],
            },
          ],
        },
        {
          id: 'L2',
          rules: [
            {
              id: 'r2',
              fields: ['depth'],
              mappings: [
                { scale: { scheme: 'identity' }, channels: ['plot-y'] },
              ],
            },
          ],
        },
      ],
    };

    const spec = grammarToPlotSpec(state);
    expect(Object.keys(spec!.encoding)).toEqual(['x', 'y']);
  });

  it('ignores map channels mixed with plot channels', () => {
    const state: IGrammarSymbologyState = {
      layers: [
        {
          id: 'L1',
          rules: [
            {
              id: 'r1',
              fields: ['mag'],
              mappings: [
                {
                  scale: { scheme: 'identity' },
                  channels: ['plot-x', 'fill-color', 'circle-radius'],
                },
              ],
            },
          ],
        },
      ],
    };

    const spec = grammarToPlotSpec(state);
    expect(spec).not.toBeNull();
    expect(Object.keys(spec!.encoding)).toEqual(['x']);
  });
});


// ---------------------------------------------------------------------------
// grammarToPlotSpec — bin transform (native Vega-Lite)
// ---------------------------------------------------------------------------

describe('grammarToPlotSpec — bin transform', () => {
  it('emits bin:true and aggregate:count for $binned/$count', () => {
    const state: any = {
      layers: [
        {
          id: 'L1',
          preprocess: [{ type: 'bin', field: 'mag', bins: 20 }],
          rules: [
            {
              id: 'r1',
              fields: ['$binned'],
              mappings: [
                { scale: { scheme: 'identity' }, channels: ['plot-x'] },
              ],
            },
            {
              id: 'r2',
              fields: ['$count'],
              mappings: [
                { scale: { scheme: 'identity' }, channels: ['plot-y'] },
              ],
            },
          ],
        },
      ],
    };

    const spec = grammarToPlotSpec(state);
    expect(spec!.mark).toBe('bar');
    expect(spec!.encoding.x).toEqual({
      field: 'mag',
      type: 'quantitative',
      bin: true,
    });
    expect(spec!.encoding.y).toEqual({
      aggregate: 'count',
      type: 'quantitative',
    });
  });

  it('emits aggregate:count with colorramp for $count color', () => {
    const state: any = {
      layers: [
        {
          id: 'L1',
          preprocess: [{ type: 'bin', field: 'mag', bins: 20 }],
          rules: [
            {
              id: 'r1',
              fields: ['$binned'],
              mappings: [
                { scale: { scheme: 'identity' }, channels: ['plot-x'] },
              ],
            },
            {
              id: 'r2',
              fields: ['$count'],
              mappings: [
                {
                  scale: {
                    scheme: 'colorRamp',
                    params: {
                      name: 'viridis',
                      nShades: 9,
                      mode: 'equal interval',
                      reverse: false,
                      fallback: [0, 0, 0, 0],
                    },
                  },
                  channels: ['plot-color'],
                },
              ],
            },
          ],
        },
      ],
    };

    const spec = grammarToPlotSpec(state);
    expect(spec!.encoding.color).toEqual({
      aggregate: 'count',
      type: 'quantitative',
      scale: { scheme: 'viridis' },
      legend: true,
    });
  });

  it('respects explicit mark override', () => {
    const state: any = {
      layers: [
        {
          id: 'L1',
          preprocess: [{ type: 'bin', field: 'mag', bins: 10 }],
          rules: [
            {
              id: 'r1',
              fields: ['$binned'],
              mappings: [
                { scale: { scheme: 'identity' }, channels: ['plot-x'] },
              ],
            },
          ],
        },
      ],
    };

    const spec = grammarToPlotSpec(state, 'line');
    expect(spec!.mark).toBe('line');
  });
});

// ---------------------------------------------------------------------------
// compilePlot
// ---------------------------------------------------------------------------

describe('compilePlot', () => {
  it('returns null when no plot channels', () => {
    const state: IGrammarSymbologyState = {
      layers: [{ id: 'L1', rules: [] }],
    };
    expect(compilePlot(state, [])).toBeNull();
  });

  it('returns spec and unchanged data without transforms', () => {
    const state: any = {
      layers: [
        {
          id: 'L1',
          rules: [
            {
              id: 'r1',
              fields: ['mag'],
              mappings: [
                { scale: { scheme: 'identity' }, channels: ['plot-x'] },
              ],
            },
          ],
        },
      ],
    };
    const data = [{ mag: 1 }, { mag: 2 }];
    const result = compilePlot(state, data);
    expect(result).not.toBeNull();
    expect(result!.spec.encoding).toHaveProperty('x');
    expect(result!.data).toEqual(data);
  });

  it('passes data through unchanged (bin handled natively by Vega-Lite)', () => {
    const state: any = {
      layers: [
        {
          id: 'L1',
          preprocess: [{ type: 'bin', field: 'mag', bins: 2 }],
          rules: [
            {
              id: 'r1',
              fields: ['$binned'],
              mappings: [
                { scale: { scheme: 'identity' }, channels: ['plot-x'] },
              ],
            },
          ],
        },
      ],
    };
    const data = [{ mag: 1 }, { mag: 2 }, { mag: 3 }, { mag: 4 }];
    const result = compilePlot(state, data);
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(data); // pass-through, VL handles binning
  });
});
