import { Layer, Vector as VectorLayer } from 'ol/layer';
import LayerGroup from 'ol/layer/Group';
import { Vector as VectorSource } from 'ol/source';

export function getVectorSourceFromLayer(
  getLayer: (layerId: string) => Layer | undefined,
  layerId: string,
): VectorSource | undefined {
  const matchingLayer = getLayer(layerId);
  let source: VectorSource | undefined;

  if (matchingLayer instanceof LayerGroup) {
    for (const sub of matchingLayer.getLayers().getArray()) {
      if (typeof (sub as VectorLayer).getSource === 'function') {
        source = (sub as VectorLayer).getSource() as VectorSource;
        break;
      }
    }
  } else if (
    matchingLayer &&
    typeof (matchingLayer as VectorLayer).getSource === 'function'
  ) {
    source = (matchingLayer as VectorLayer).getSource() as VectorSource;
  }

  return source;
}

export function isDrawLayer(
  getLayer: (layerId: string) => Layer | undefined,
  drawLayerId: string | undefined,
  layer: Layer,
): boolean {
  if (!drawLayerId) {
    return false;
  }

  if (layer.get('id') === drawLayerId) {
    return true;
  }

  const expected = getLayer(drawLayerId);
  if (expected instanceof LayerGroup) {
    return expected.getLayers().getArray().includes(layer);
  }

  return false;
}
