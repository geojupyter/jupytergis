import { IJGISLayer } from '@jupytergis/schema';
import BaseLayer from 'ol/layer/Base';
import Layer from 'ol/layer/Layer';
import VectorSource from 'ol/source/Vector';

/**
 * The vector source whose features a document layer draws.
 *
 * A layer with several grammar layers, or one on a feature store, is an OL
 * layer group with no source of its own, so look the source up by the id the
 * document holds. A plain layer whose source is not registered falls back to
 * the map layer's own source.
 */
export function vectorSourceForLayer(
  layer: IJGISLayer | undefined,
  mapLayer: BaseLayer | undefined,
  sources: Map<string, unknown>,
): VectorSource | undefined {
  const sourceId = layer?.parameters?.source;
  const registered = sourceId ? sources.get(sourceId) : undefined;
  if (registered instanceof VectorSource) {
    return registered;
  }

  const own = mapLayer instanceof Layer ? mapLayer.getSource() : undefined;
  return own instanceof VectorSource ? own : undefined;
}

/**
 * Store `<field>ms`, the epoch milliseconds of `field`, on every feature of
 * the source, so a `between` guard can compare the time as a number.
 */
export function setFeatureTimeMs(source: VectorSource, field: string): void {
  source.forEachFeature(feature => {
    const time = feature.get(field);
    const parsedTime = typeof time === 'string' ? Date.parse(time) : time;
    feature.set(`${field}ms`, parsedTime);
  });
}
