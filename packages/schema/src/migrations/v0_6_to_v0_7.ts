/**
 * Migration from schema version 0.6.0 to 0.7.0.
 *
 * Moves `declutter` off the grammar layers and onto the jGIS layer:
 *  - `parameters.symbologyState.layers[].declutter` → `parameters.declutter`
 */

export function migrate(doc: Record<string, any>): Record<string, any> {
  const layers: Record<string, any> = { ...doc.layers };

  for (const [id, layer] of Object.entries(layers)) {
    if (layer?.type !== 'VectorLayer' && layer?.type !== 'VectorTileLayer') {
      continue;
    }

    const params = layer.parameters ?? {};
    const state = params.symbologyState;
    if (!state || typeof state !== 'object' || !Array.isArray(state.layers)) {
      continue;
    }

    let declutter = false;
    const grammarLayers = state.layers.map((gl: Record<string, any>) => {
      if (!gl || typeof gl !== 'object') {
        return gl;
      }
      const { declutter: glDeclutter, ...rest } = gl;
      declutter = declutter || !!glDeclutter;
      return rest;
    });

    const newParams: Record<string, any> = {
      ...params,
      symbologyState: { ...state, layers: grammarLayers },
    };
    if (declutter) {
      newParams.declutter = true;
    }

    layers[id] = { ...layer, parameters: newParams };
  }

  return { ...doc, layers };
}
