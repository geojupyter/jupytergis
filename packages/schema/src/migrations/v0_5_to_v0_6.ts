/**
 * Migration from schema version 0.5.0 to 0.6.0.
 *
 * Converts the legacy `parameters.color` representation (OpenLayers FlatStyle
 * keys such as `fill-color`, `stroke-color`, `circle-radius`) to the
 * structured `parameters.symbologyState` field introduced in 0.6.0.
 */

export function migrate(doc: Record<string, any>): Record<string, any> {
  const layers: Record<string, any> = { ...doc.layers };

  for (const [id, layer] of Object.entries(layers)) {
    const params = layer?.parameters;
    if (!params || !('color' in params)) {
      continue;
    }

    const color = params.color;
    const newParams = { ...params };

    if (layer.type === 'VectorLayer' || layer.type === 'VectorTileLayer') {
      if (color && typeof color === 'object' && !Array.isArray(color)) {
        if (!params.symbologyState) {
          newParams.symbologyState = _vectorSymbologyFromColor(color);
        }
      }
    } else if (layer.type === 'HeatmapLayer') {
      if (Array.isArray(color)) {
        const state = params.symbologyState ?? { renderType: 'Heatmap' };
        if (!state.gradient) {
          newParams.symbologyState = { ...state, gradient: color };
        }
      }
    }

    delete newParams.color;
    layers[id] = { ...layer, parameters: newParams };
  }

  return { ...doc, layers };
}

function _vectorSymbologyFromColor(
  colorExpr: Record<string, unknown>,
): Record<string, unknown> {
  const state: Record<string, unknown> = { renderType: 'Single Symbol' };

  const fill = _firstSolidColor(
    colorExpr['fill-color'],
    colorExpr['circle-fill-color'],
  );
  if (fill) {
    state.fillColor = fill;
  }

  const stroke = _firstSolidColor(
    colorExpr['stroke-color'],
    colorExpr['circle-stroke-color'],
  );
  if (stroke) {
    state.strokeColor = stroke;
  }

  const sw = colorExpr['stroke-width'] ?? colorExpr['circle-stroke-width'];
  if (typeof sw === 'number') {
    state.strokeWidth = sw;
  }

  const r = colorExpr['circle-radius'];
  if (typeof r === 'number') {
    state.radius = r;
  }

  if ('circle-fill-color' in colorExpr || 'circle-radius' in colorExpr) {
    state.geometryType = 'circle';
  } else if ('fill-color' in colorExpr) {
    state.geometryType = 'fill';
  } else if ('stroke-color' in colorExpr || 'stroke-width' in colorExpr) {
    state.geometryType = 'line';
  }

  return state;
}

/** Returns the first candidate that is a plain solid color array [r,g,b,a]. */
function _firstSolidColor(...candidates: unknown[]): number[] | undefined {
  for (const c of candidates) {
    if (Array.isArray(c) && c.length >= 3 && typeof c[0] === 'number') {
      const [r = 0, g = 0, b = 0, a = 1] = c as number[];
      return [r, g, b, a];
    }
  }
  return undefined;
}
