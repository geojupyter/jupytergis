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
 * A KDE (heatmap) grammar layer becomes MapLibre's native 'heatmap' layer:
 *
 *   kde radius + blur                -> heatmap-radius
 *   kde weightField                  -> heatmap-weight
 *   pixel-color colorMap             -> heatmap-color
 */

import {
  IGrammarLayer,
  IGrammarSymbologyState,
  IKDETransform,
} from '@jupytergis/schema';

import {
  DEFAULT_HEATMAP_GRADIENT,
  extractHeatmapGradient,
} from '../../../features/layers/symbology/heatmapGradient';
import { DEFAULT_FLAT_STYLE } from '../../../features/layers/symbology/styleBuilder';
import { grammarToOLStyle } from '../openlayers/grammarToOLStyle';

export type MapLibreSubLayerType = 'fill' | 'line' | 'circle' | 'heatmap';

export interface IMapLibreLayerSpec {
  id: string;
  type: MapLibreSubLayerType;
  source: string;
  'source-layer'?: string;
  filter?: any[];
  layout: { visibility: 'visible' | 'none' };
  paint: Record<string, any>;
}

export interface IGrammarToMapLibreOptions {
  id: string;
  sourceId: string;
  heatmapSourceId?: string;
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
    // MapLibre reads the zoom only in a top-level step or interpolate, so a zoom
    // condition cannot be expressed here. Let it pass so the layer still draws.
    if (Array.isArray(args[0]) && args[0][0] === 'resolution') {
      return true;
    }
    if (
      op === 'case' &&
      args.length === 3 &&
      Array.isArray(args[0]) &&
      args[0][0] === 'has' &&
      typeof args[0][1] === 'string' &&
      Array.isArray(args[1]) &&
      args[1][0] === 'interpolate'
    ) {
      const ramp = toMapLibreExpr(args[1]);
      const fallback = toMapLibreExpr(args[2]);

      if (ramp === undefined || fallback === undefined) {
        return undefined;
      }

      const numericRamp =
        Array.isArray(ramp) &&
        ramp[0] === 'interpolate' &&
        Array.isArray(ramp[2]) &&
        ramp[2][0] === 'get'
          ? [...ramp.slice(0, 2), ['to-number', ramp[2]], ...ramp.slice(3)]
          : ramp;

      return ['case', ['has', args[0][1]], numericRamp, fallback];
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

/** The same color with alpha 0, so a heatmap fades in from nothing. */
function transparentVariant(color: string): string {
  const s = color.trim().toLowerCase();
  const fn = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (fn) {
    return `rgba(${fn[1]}, ${fn[2]}, ${fn[3]}, 0)`;
  }
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map(c => c + c)
            .join('')
        : hex[1];
    return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, 0)`;
  }
  return 'rgba(0, 0, 0, 0)';
}

/**
 * MapLibre's heatmap-color is a ramp over density 0..1. Start it fully
 * transparent (the docs' advice, so the edge blurs out), then spread the
 * gradient's colors evenly over the rest, hottest at density 1.
 */
export function gradientToHeatmapColor(gradient: string[]): any[] {
  const n = gradient.length;
  return [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0,
    transparentVariant(gradient[0]),
    ...gradient.flatMap((color, i) => [(i + 1) / n, color]),
  ];
}

function compileKdeLayer(
  o: IGrammarToMapLibreOptions,
  grammarLayer: IGrammarLayer,
  kde: IKDETransform,
  index: number,
): IMapLibreLayerSpec {
  const gradient =
    extractHeatmapGradient(grammarLayer.rules) ?? DEFAULT_HEATMAP_GRADIENT;

  return {
    id: `${o.id}:${index}:heatmap`,
    type: 'heatmap',
    source: o.heatmapSourceId ?? o.sourceId,
    ...(o.sourceLayer ? { 'source-layer': o.sourceLayer } : {}),
    filter: isGeom('Point', 'MultiPoint', 'Polygon', 'MultiPolygon'),
    layout: { visibility: o.visible ? 'visible' : 'none' },
    paint: {
      'heatmap-radius': (kde.radius ?? 10) + (kde.blur ?? 15),
      'heatmap-color': gradientToHeatmapColor(gradient),
      'heatmap-opacity': o.opacity,
      ...(kde.weightField
        ? { 'heatmap-weight': ['to-number', ['get', kde.weightField], 1] }
        : {}),
    },
  };
}

function compileGrammarLayer(
  o: IGrammarToMapLibreOptions,
  grammarLayer: IGrammarLayer | undefined,
  index: number,
): IMapLibreLayerSpec[] {
  const kde = grammarLayer?.preprocess?.find(
    (t): t is IKDETransform => t.type === 'kde',
  );
  if (grammarLayer && kde) {
    return [compileKdeLayer(o, grammarLayer, kde, index)];
  }

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
  options: IGrammarToMapLibreOptions,
): IMapLibreLayerSpec[] {
  const grammarLayers = options.state?.layers ?? [];

  if (grammarLayers.length === 0) {
    return compileGrammarLayer(options, undefined, 0);
  }

  return [...grammarLayers]
    .reverse()
    .flatMap((gl, i) => compileGrammarLayer(options, gl, i));
}
