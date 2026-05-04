/**
 * Migration from schema version 0.6.0 to 0.7.0.
 *
 * Converts VectorLayer and VectorTileLayer symbologyState to Grammar format.
 * Supported render types: Single Symbol, Graduated, Categorized.
 * Canonical and Grammar layers are left unchanged.
 */

import {
  graduatedToGrammar,
  categorizedToGrammar,
  singleSymbolToGrammar,
  SymbologyState,
} from '../grammar/grammarConversions';

export function migrate(doc: Record<string, any>): Record<string, any> {
  const layers: Record<string, any> = { ...doc.layers };

  for (const [id, layer] of Object.entries(layers)) {
    if (layer.type !== 'VectorLayer' && layer.type !== 'VectorTileLayer') {
      continue;
    }
    const params = layer?.parameters;
    if (!params) {
      continue;
    }
    const state: SymbologyState | undefined = params.symbologyState;
    if (!state?.renderType || state.renderType === 'Grammar') {
      continue;
    }

    let grammarState;
    switch (state.renderType) {
      case 'Single Symbol':
        grammarState = singleSymbolToGrammar(state);
        break;
      case 'Graduated':
        grammarState = graduatedToGrammar(state);
        break;
      case 'Categorized':
        grammarState = categorizedToGrammar(state);
        break;
      default:
        continue;
    }

    layers[id] = {
      ...layer,
      parameters: { ...params, symbologyState: grammarState },
    };
  }

  return { ...doc, layers };
}
