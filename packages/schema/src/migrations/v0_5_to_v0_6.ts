/**
 * Migration from schema version 0.5.0 to 0.6.0.
 *
 * Converts legacy representations to Grammar symbologyState in one pass:
 *  - parameters.color (flat OL FlatStyle keys) → Grammar directly
 *  - parameters.symbologyState with old render types → Grammar
 *  - HeatmapLayer color array → symbologyState.gradient
 *  - WebGlLayer type → GeoTiffLayer
 *  - layer.filters → grammar layer-level when + whenOp (filters removed)
 *  - flat metadata keys ``annotation_<id>`` → top-level ``annotations``
 */

import {
  categorizedToGrammar,
  graduatedToGrammar,
  singleSymbolToGrammar,
  SymbologyState,
} from '../grammar/grammarConversions';

const ANNOTATION_KEY_PATTERN = /^annotation_(.+)$/;

export function migrate(doc: Record<string, any>): Record<string, any> {
  const layers: Record<string, any> = { ...doc.layers };

  for (const [id, layer] of Object.entries(layers)) {
    const newType = layer.type === 'WebGlLayer' ? 'GeoTiffLayer' : layer.type;
    const params = layer?.parameters;

    if (!params) {
      if (newType !== layer.type) {
        layers[id] = { ...layer, type: newType };
      }
      continue;
    }

    const newParams = { ...params };

    if (layer.type === 'VectorLayer' || layer.type === 'VectorTileLayer') {
      const color = newParams.color;
      if (color && typeof color === 'object' && !Array.isArray(color)) {
        // Flat OL color dict → Grammar (skip intermediate symbologyState format)
        newParams.symbologyState = singleSymbolToGrammar(
          _colorToState(color as Record<string, unknown>),
        );
        delete newParams.color;
      } else {
        // Handle files that already carry old-style symbologyState (defensive)
        const state: SymbologyState | undefined = newParams.symbologyState;
        if (state?.renderType && state.renderType !== 'Grammar') {
          switch (state.renderType) {
            case 'Single Symbol':
              newParams.symbologyState = singleSymbolToGrammar(state);
              break;
            case 'Graduated':
              newParams.symbologyState = graduatedToGrammar(state);
              break;
            case 'Categorized':
              newParams.symbologyState = categorizedToGrammar(state);
              break;
          }
        }
      }
    } else if (layer.type === 'HeatmapLayer') {
      if (Array.isArray(newParams.color)) {
        const state = newParams.symbologyState ?? { renderType: 'Heatmap' };
        if (!state.gradient) {
          newParams.symbologyState = { ...state, gradient: newParams.color };
        }
        delete newParams.color;
      }
    }

    // Convert legacy layer.filters → grammar layer-level when + whenOp.
    const filters = layer.filters;
    if (filters?.appliedFilters?.length) {
      const logicalOp: 'all' | 'any' =
        filters.logicalOp === 'any' ? 'any' : 'all';
      const predicates: Record<string, any>[] = [];

      for (const item of filters.appliedFilters as Record<string, any>[]) {
        if (item.operator === 'between') {
          if (item.betweenMin !== undefined && item.betweenMax !== undefined) {
            predicates.push({
              type: 'between',
              field: item.feature,
              min: item.betweenMin,
              max: item.betweenMax,
            });
          }
        } else if (item.operator === '==') {
          predicates.push({
            type: 'fieldEquals',
            field: item.feature,
            value: item.value,
          });
        } else {
          predicates.push({
            type: 'fieldCompare',
            field: item.feature,
            op: item.operator,
            value: item.value,
          });
        }
      }

      if (predicates.length) {
        const symbologyState = newParams.symbologyState;
        if (
          Array.isArray(symbologyState?.layers) &&
          symbologyState.layers.length > 0
        ) {
          newParams.symbologyState = {
            ...symbologyState,
            layers: symbologyState.layers.map((gl: Record<string, any>) => ({
              ...gl,
              when: [...(gl.when ?? []), ...predicates],
              whenOp: gl.whenOp ?? logicalOp,
            })),
          };
        }
      }
    }

    const { filters: _, ...layerWithoutFilters } = { ...layer, type: newType };
    layers[id] = { ...layerWithoutFilters, parameters: newParams };
  }

  return _migrateAnnotations({ ...doc, layers });
}

function _migrateAnnotations(doc: Record<string, any>): Record<string, any> {
  const metadata = { ...(doc.metadata ?? {}) };
  const annotations: Record<string, any> =
    doc.annotations &&
    typeof doc.annotations === 'object' &&
    !Array.isArray(doc.annotations)
      ? { ...doc.annotations }
      : {};

  const nested = metadata.annotations;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    Object.assign(annotations, nested);
  }

  for (const [key, value] of Object.entries(metadata)) {
    const match = ANNOTATION_KEY_PATTERN.exec(key);
    if (!match) {
      continue;
    }

    let annotation = value;
    if (typeof annotation === 'string') {
      try {
        annotation = JSON.parse(annotation);
      } catch {
        continue;
      }
    }

    annotations[match[1]] = annotation;
  }

  return {
    ...doc,
    annotations,
    metadata: {},
    presets: {},
  };
}

/** Build a SymbologyState from a flat OL color dict. */
function _colorToState(color: Record<string, unknown>): SymbologyState {
  const state: SymbologyState = { renderType: 'Single Symbol' };

  const fill = _firstSolidColor(
    color['fill-color'],
    color['circle-fill-color'],
  );
  if (fill) {
    state.fillColor = fill;
  }

  const stroke = _firstSolidColor(
    color['stroke-color'],
    color['circle-stroke-color'],
  );
  if (stroke) {
    state.strokeColor = stroke;
  }

  const sw = color['stroke-width'] ?? color['circle-stroke-width'];
  if (typeof sw === 'number') {
    state.strokeWidth = sw;
  }

  const r = color['circle-radius'];
  if (typeof r === 'number') {
    state.radius = r;
  }

  return state;
}

function _firstSolidColor(...candidates: unknown[]): number[] | undefined {
  for (const c of candidates) {
    if (Array.isArray(c) && c.length >= 3 && typeof c[0] === 'number') {
      const [r = 0, g = 0, b = 0, a = 1] = c as number[];
      return [r, g, b, a];
    }
    if (typeof c === 'string') {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(c);
      if (m) {
        return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), 1];
      }
    }
  }
  return undefined;
}
