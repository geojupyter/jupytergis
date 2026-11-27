import {
  IEncodingRule,
  IGrammarLayer,
  IGrammarSymbologyState,
  IJGISLayer,
  IPredicate,
} from '@jupytergis/schema';

type IGuarded = Pick<IGrammarLayer, 'when' | 'whenOp'>;

/**
 * Whether appending a predicate to this guard narrows it. An `any` guard with
 * two or more predicates would be widened instead, since predicates can't nest.
 */
function acceptsAnd(guarded: IGuarded): boolean {
  return guarded.whenOp !== 'any' || (guarded.when?.length ?? 0) <= 1;
}

function withGuard<T extends IGuarded>(guarded: T, predicate: IPredicate): T {
  return {
    ...guarded,
    when: [...(guarded.when ?? []), predicate],
    whenOp: 'all',
  };
}

function guardGrammarLayer(
  grammarLayer: IGrammarLayer,
  predicate: IPredicate,
): IGrammarLayer {
  if (acceptsAnd(grammarLayer)) {
    return withGuard(grammarLayer, predicate);
  }

  // The layer guard ORs several predicates. The renderers AND the layer guard
  // with each rule's own guard, so the time window goes one level down. A
  // rule that also ORs several predicates has nowhere left to take it and is
  // left unfiltered.
  return {
    ...grammarLayer,
    rules: (grammarLayer.rules ?? []).map((rule: IEncodingRule) =>
      acceptsAnd(rule) ? withGuard(rule, predicate) : rule,
    ),
  };
}

/**
 * Copy of `layer` whose grammar layers only draw features with `field` in
 * [min, max]. The input is left untouched; the result is meant for a local
 * layer update, not for the document. A layer without grammar layers is
 * returned as is, since there is no guard to add the window to.
 */
export function withTemporalPredicate(
  layer: IJGISLayer,
  field: string,
  min: number,
  max: number,
): IJGISLayer {
  const state = layer.parameters?.symbologyState as
    | IGrammarSymbologyState
    | undefined;
  if (!Array.isArray(state?.layers) || state.layers.length === 0) {
    return layer;
  }

  const predicate: IPredicate = { type: 'between', field, min, max };

  return {
    ...layer,
    parameters: {
      ...layer.parameters,
      symbologyState: {
        ...state,
        layers: state.layers.map((gl) => guardGrammarLayer(gl, predicate)),
      },
    },
  };
}
