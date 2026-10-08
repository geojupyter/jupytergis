import { Map as OlMap } from 'ol';
import Feature from 'ol/Feature';
import { VectorImage as VectorImageLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import CircleStyle from 'ol/style/Circle';

import { getCssVarValue } from '@/src/tools';

const FALLBACK_BRAND_1 = '#1976d2';
const FALLBACK_BRAND_2 = '#64b5f6';
const FALLBACK_BRAND_3 = '#bbdefb';

interface IIdentifyHighlightColors {
  stroke: string;
  strokeMuted: string;
  fill: string;
}

/**
 * Theme-aware identify highlight colors from JupyterLab brand.
 */
function getIdentifyHighlightColors(): IIdentifyHighlightColors {
  const mainBrand = getCssVarValue('--jp-brand-color1') || FALLBACK_BRAND_1;
  const mutedBrand = getCssVarValue('--jp-brand-color2') || FALLBACK_BRAND_2;
  const lightBrand = getCssVarValue('--jp-brand-color3') || FALLBACK_BRAND_3;

  return {
    stroke: mainBrand,
    strokeMuted: mutedBrand,
    fill: lightBrand,
  };
}

/**
 * Build a highlight style from an original resolved style.
 * Preserves data-driven properties (circle radius, line width) and swaps in
 * the JupyterLab brand color.
 */
export function buildHighlightStyle(original: Style, geomType?: string): Style {
  const { stroke, strokeMuted, fill } = getIdentifyHighlightColors();

  // Only use the circle branch for point geometries.  The OL default style
  // includes a circle image alongside fill/stroke; without this guard the
  // circle branch would fire for polygons and produce an invisible style.
  const isPoint = geomType === 'Point' || geomType === 'MultiPoint';
  if (isPoint) {
    const image = original.getImage();
    if (image instanceof CircleStyle) {
      return new Style({
        image: new Circle({
          radius: image.getRadius(),
          fill: new Fill({ color: 'transparent' }),
          stroke: new Stroke({ color: stroke, width: 3 }),
        }),
      });
    }
  }

  const origStroke = original.getStroke();
  const origFill = original.getFill();

  if (origStroke || origFill) {
    return new Style({
      stroke: new Stroke({
        color: strokeMuted,
        width: (origStroke?.getWidth() ?? 1) + 3,
      }),
      ...(origFill ? { fill: new Fill({ color: fill }) } : {}),
    });
  }

  // Fallback
  return new Style({
    stroke: new Stroke({ color: strokeMuted, width: 3 }),
  });
}

/**
 * Style function used by the highlight overlay layer.
 * Returns a theme-aware highlight style based on geometry type.
 */
function highlightStyleFunction(feature: Feature): Style {
  const { stroke, strokeMuted, fill } = getIdentifyHighlightColors();
  const geomType = feature.getGeometry()?.getType();
  switch (geomType) {
    case 'Point':
    case 'MultiPoint':
      return new Style({
        image: new Circle({
          radius: 8,
          fill: new Fill({ color: 'transparent' }),
          stroke: new Stroke({ color: stroke, width: 3 }),
        }),
      });
    case 'LineString':
    case 'MultiLineString':
      return new Style({
        stroke: new Stroke({ color: strokeMuted, width: 3 }),
      });
    case 'Polygon':
    case 'MultiPolygon':
      return new Style({
        stroke: new Stroke({ color: stroke, width: 2 }),
        fill: new Fill({ color: fill }),
      });
    default:
      return new Style({
        stroke: new Stroke({ color: stroke, width: 2 }),
      });
  }
}

/**
 * Ensure the highlight layer exists and is attached to the map.
 * Creates it on first call; re-adds it if the map removed it
 * (e.g. during a layer sync that strips non-model layers).
 */
export function ensureHighlightLayer(
  map: OlMap,
  layerRef: { current: VectorImageLayer<VectorSource> | null },
): VectorImageLayer<VectorSource> {
  if (
    layerRef.current &&
    map.getLayers().getArray().includes(layerRef.current)
  ) {
    return layerRef.current;
  }

  if (!layerRef.current) {
    layerRef.current = new VectorImageLayer({
      source: new VectorSource(),
      style: highlightStyleFunction as any,
      zIndex: 999,
    });
  }

  map.addLayer(layerRef.current);
  return layerRef.current;
}
