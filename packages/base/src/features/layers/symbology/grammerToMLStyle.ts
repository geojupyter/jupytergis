/**
 * Grammar -> MapLibre layer compiler.
 *
 * Reuses grammarToOLStyle (the single source of truth for what a symbology
 * state means) and translates its OL flat-style output into MapLibre layer
 * specs. OL draws fill/stroke/circle from one style; MapLibre needs one layer
 * per geometry kind, so a grammar layer becomes up to three layers:
 *
 *   fill-color                       -> 'fill'   layer (Polygon)
 *   stroke-color / stroke-width      -> 'line'   layer (Polygon outline + LineString)
 *   circle-* keys                    -> 'circle' layer (Point)
 *
 * KDE (heatmap) grammar layers are skipped for now; MapLibre has a native
 * 'heatmap' layer type that can be added as a follow-up.
 */

import { IGrammarLayer, IGrammarSymbologyState } from '@jupytergis/schema';

import { grammarToOLStyle } from './grammarToOLStyle';
import { DEFAULT_FLAT_STYLE } from './styleBuilder';

export type MapLibreSubLayerType = 'fill' | 'line' | 'circle';

export interface IMapLibreLayerSpec {
  id: string;
  type: MapLibreSubLayerType;
  source: string;
  'source-layer'?: string;
  filter: any[];
  layout: { visibility: 'visible' | 'none' };
  paint: Record<string, any>;
}

export interface IGrammarToMapLibreOptions {
  id: string;
  sourceId: string;
  state: IGrammarSymbologyState | undefined;
  featureValues: unknown[];
  opacity: number;
  visible: boolean;
  sourceLayer?: string;
}

const isGeom = (...types: string[]) =>
  types.length === 1
    ? ['==', ['geometry-type'], types[0]]
    : ['any', ...types.map(t => ['==', ['geometry-type'], t])];

const isNumberArray = (v: unknown[]): v is number[] =>
  v.length >= 3 && v.length <= 4 && v.every(x => typeof x === 'number');

/**
 * Translate an OL expression to a MapLibre one.
 *  - ['color', r, g, b, a]   ->   ['rgba', r, g, b, a]
 */
export function toMapLibreExpr(value: any): any {
  if (!Array.isArray(value)) {
    return value;
  }
  if (typeof value[0] === 'string') {
    const [op, ...args] = value;
    if (op === 'band') {
      return undefined;
    }
    const translated = args.map(toMapLibreExpr);
    if (translated.some(a => a === undefined)) {
      return undefined;
    }
    return [op === 'color' ? 'rgba' : op, ...translated];
  }
  if (isNumberArray(value)) {
    const [r, g, b, a = 1] = value;
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
  }
  return ['literal', value];
}

function compileGrammarLayer(
  o: IGrammarToMapLibreOptions,
  grammarLayer: IGrammarLayer | undefined,
  index: number,
): IMapLibreLayerSpec[] {
  // Same fallback OL uses when a grammar layer produces no style at all.
  const compiled = grammarLayer
    ? grammarToOLStyle({ layers: [grammarLayer] }, o.featureValues)
    : {};
  const flat: Record<string, any> =
    Object.keys(compiled).length === 0 ? DEFAULT_FLAT_STYLE : compiled;

  const t = (key: string, fallback?: any) => {
    if (!(key in flat)) {
      return fallback;
    }
    const out = toMapLibreExpr(flat[key]);
    return out === undefined ? fallback : out;
  };

  const base = {
    source: o.sourceId,
    ...(o.sourceLayer ? { 'source-layer': o.sourceLayer } : {}),
    layout: { visibility: o.visible ? 'visible' : 'none' } as const,
  };
  const specs: IMapLibreLayerSpec[] = [];

  if ('fill-color' in flat) {
    specs.push({
      ...base,
      id: `${o.id}:${index}:fill`,
      type: 'fill',
      filter: isGeom('Polygon'),
      paint: { 'fill-color': t('fill-color'), 'fill-opacity': o.opacity },
    });
  }

  if ('stroke-color' in flat || 'stroke-width' in flat) {
    specs.push({
      ...base,
      id: `${o.id}:${index}:line`,
      type: 'line',
      filter: isGeom('Polygon', 'LineString'),
      paint: {
        'line-color': t('stroke-color', '#3399cc'),
        'line-width': t('stroke-width', 1),
        'line-opacity': o.opacity,
      },
    });
  }

  if (
    'circle-fill-color' in flat ||
    'circle-radius' in flat ||
    'circle-stroke-color' in flat
  ) {
    specs.push({
      ...base,
      id: `${o.id}:${index}:circle`,
      type: 'circle',
      filter: isGeom('Point'),
      paint: {
        'circle-color': t('circle-fill-color', '#3399cc'),
        'circle-radius': t('circle-radius', 5),
        'circle-stroke-color': t('circle-stroke-color', '#ffffff'),
        'circle-stroke-width': t('circle-stroke-width', 0),
        'circle-opacity': o.opacity,
        'circle-stroke-opacity': o.opacity,
      },
    });
  }

  return specs;
}

/**
 * Compile a symbology state to MapLibre layer specs, bottom → top.
 * The UI lists grammar layers top-first (top of list = on top of the map),
 * while MapLibre draws later layers on top, so we walk the list in reverse.
 */
export function grammarToMapLibreLayers(
  o: IGrammarToMapLibreOptions,
): IMapLibreLayerSpec[] {
  const grammarLayers = (o.state?.layers ?? []).filter(
    gl => !gl.preprocess?.some(t => t.type === 'kde'),
  );

  if (grammarLayers.length === 0) {
    // No symbology yet (or only KDE): draw with the default style.
    return compileGrammarLayer(o, undefined, 0);
  }

  return [...grammarLayers]
    .reverse()
    .flatMap((gl, i) => compileGrammarLayer(o, gl, i));
}
