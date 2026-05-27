import { Map as OlMap } from 'ol';
import Feature from 'ol/Feature';
import { VectorImage as VectorImageLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Circle, Fill, Stroke, Style } from 'ol/style';

/**
 * Style function used by the highlight overlay layer.
 * Returns a fixed highlight style based on geometry type.
 */
function highlightStyleFunction(feature: Feature): Style {
  const geomType = feature.getGeometry()?.getType();
  switch (geomType) {
    case 'Point':
    case 'MultiPoint':
      return new Style({
        image: new Circle({
          radius: 8,
          fill: new Fill({ color: 'transparent' }),
          stroke: new Stroke({ color: '#ff0', width: 3 }),
        }),
      });
    case 'LineString':
    case 'MultiLineString':
      return new Style({
        stroke: new Stroke({ color: 'rgba(255, 255, 0, 0.8)', width: 3 }),
      });
    case 'Polygon':
    case 'MultiPolygon':
      return new Style({
        stroke: new Stroke({ color: '#ff0', width: 2 }),
        fill: new Fill({ color: 'rgba(255, 255, 0, 0.15)' }),
      });
    default:
      return new Style({
        stroke: new Stroke({ color: '#ff0', width: 2 }),
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
