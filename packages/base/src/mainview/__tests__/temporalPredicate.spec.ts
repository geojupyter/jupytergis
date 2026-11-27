/**
 * Unit tests for withTemporalPredicate, the helper the temporal controller
 * uses to narrow a layer's grammar guards to a time window (issue #2025).
 */

jest.mock('@jupytergis/schema', () => ({}));

import { IGrammarLayer, IJGISLayer } from '@jupytergis/schema';

import { withTemporalPredicate } from '@/src/mainview/utils/temporalPredicate';

const WINDOW = { type: 'between', field: 'timems', min: 10, max: 20 };

const constantRule = (id: string): IGrammarLayer['rules'][number] => ({
  id,
  mappings: [
    {
      scale: { scheme: 'constant_rgba', params: { value: [255, 0, 0, 1] } },
      encodings: ['fill-color'],
    },
  ],
});

function layerWith(...grammarLayers: IGrammarLayer[]): IJGISLayer {
  return {
    name: 'test',
    type: 'VectorLayer',
    visible: true,
    parameters: {
      source: 'src',
      opacity: 0.5,
      symbologyState: { layers: grammarLayers },
    },
  };
}

const grammarLayersOf = (layer: IJGISLayer): IGrammarLayer[] =>
  layer.parameters?.symbologyState.layers;

describe('withTemporalPredicate', () => {
  it('appends a between predicate to every grammar layer', () => {
    const result = withTemporalPredicate(
      layerWith(
        { id: 'a', rules: [constantRule('1')] },
        { id: 'b', rules: [constantRule('2')] },
      ),
      'timems',
      10,
      20,
    );

    for (const gl of grammarLayersOf(result)) {
      expect(gl.when).toEqual([WINDOW]);
      expect(gl.whenOp).toBe('all');
    }
  });

  it('keeps existing conditions and the rest of the layer', () => {
    const existing = { type: 'geometryType', value: 'Point' } as const;
    const result = withTemporalPredicate(
      layerWith({
        id: 'a',
        when: [existing],
        whenOp: 'all',
        rules: [constantRule('1')],
      }),
      'timems',
      10,
      20,
    );

    expect(grammarLayersOf(result)[0].when).toEqual([existing, WINDOW]);
    expect(grammarLayersOf(result)[0].rules).toEqual([constantRule('1')]);
    expect(result.parameters?.opacity).toBe(0.5);
    expect(result.parameters?.source).toBe('src');
    expect(result.visible).toBe(true);
  });

  it('treats a single any-predicate as safe to AND with', () => {
    const existing = { type: 'hasField', field: 'name' } as const;
    const result = withTemporalPredicate(
      layerWith({
        id: 'a',
        when: [existing],
        whenOp: 'any',
        rules: [constantRule('1')],
      }),
      'timems',
      10,
      20,
    );

    expect(grammarLayersOf(result)[0].when).toEqual([existing, WINDOW]);
    expect(grammarLayersOf(result)[0].whenOp).toBe('all');
  });

  it('pushes the window down to the rules when the layer guard is an OR', () => {
    const anyGuard = [
      { type: 'fieldEquals', field: 'kind', value: 'a' },
      { type: 'fieldEquals', field: 'kind', value: 'b' },
    ] as const;
    const ruleGuard = { type: 'geometryType', value: 'Point' } as const;
    const result = withTemporalPredicate(
      layerWith({
        id: 'a',
        when: [...anyGuard],
        whenOp: 'any',
        rules: [
          constantRule('plain'),
          { ...constantRule('guarded'), when: [ruleGuard], whenOp: 'all' },
          {
            ...constantRule('or-guarded'),
            when: [ruleGuard, { type: 'hasField', field: 'name' }],
            whenOp: 'any',
          },
        ],
      }),
      'timems',
      10,
      20,
    );

    const [gl] = grammarLayersOf(result);
    // The OR guard itself is untouched.
    expect(gl.when).toEqual(anyGuard);
    expect(gl.whenOp).toBe('any');

    const [plain, guarded, orGuarded] = gl.rules;
    expect(plain.when).toEqual([WINDOW]);
    expect(plain.whenOp).toBe('all');
    expect(guarded.when).toEqual([ruleGuard, WINDOW]);
    expect(guarded.whenOp).toBe('all');
    // Documented limit: an OR rule under an OR layer cannot take the window.
    expect(orGuarded.when).toHaveLength(2);
    expect(orGuarded.whenOp).toBe('any');
  });

  it('does not mutate its input', () => {
    const input = layerWith({
      id: 'a',
      when: [{ type: 'geometryType', value: 'Point' }],
      rules: [constantRule('1')],
    });
    const snapshot = JSON.parse(JSON.stringify(input));

    const result = withTemporalPredicate(input, 'timems', 10, 20);

    expect(result).not.toBe(input);
    expect(input).toEqual(snapshot);
  });

  it('returns the layer unchanged when there are no grammar layers', () => {
    const empty = layerWith();
    expect(withTemporalPredicate(empty, 'timems', 10, 20)).toBe(empty);

    const legacy: IJGISLayer = {
      name: 'legacy',
      type: 'VectorLayer',
      visible: true,
      parameters: { source: 'src', symbologyState: {} },
    };
    expect(withTemporalPredicate(legacy, 'timems', 10, 20)).toBe(legacy);
  });
});
