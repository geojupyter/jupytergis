import type { IFeatureStoreSource, IJupyterGISModel } from '@jupytergis/schema';
import { Layer } from 'ol/layer';
import LayerGroup from 'ol/layer/Group';
import { Vector as VectorSource } from 'ol/source';

export function getVectorSourceFromLayer(
  getOlLayer: (layerId: string) => Layer | undefined,
  layerId: string,
  model: IJupyterGISModel,
  getFeatureStoreOverlay: (storeId: string) => VectorSource | undefined,
): VectorSource | undefined {
  const matchingLayer = getOlLayer(layerId);

  if (!matchingLayer) {
    return undefined;
  }

  // Feature-store layers are LayerGroups. The baseline child is a
  // VectorTileSource, the overlay child is the VectorSource to draw on.
  if (matchingLayer instanceof LayerGroup) {
    for (const child of matchingLayer.getLayers().getArray()) {
      const childSource = (child as Layer).getSource?.();
      if (childSource instanceof VectorSource) {
        return childSource;
      }
    }

    const jgisLayer = model.getLayer(layerId);
    const sourceId = (
      jgisLayer as { parameters?: { source?: string } } | undefined
    )?.parameters?.source;
    const jgisSource = sourceId ? model.getSource(sourceId) : undefined;

    if (jgisSource?.type === 'FeatureStoreSource') {
      const storeId = (jgisSource.parameters as IFeatureStoreSource).storeId;
      return storeId ? getFeatureStoreOverlay(storeId) : undefined;
    }

    return undefined;
  }

  const source =
    (matchingLayer as Layer).getSource?.() ?? matchingLayer.get('source');

  return source instanceof VectorSource ? source : undefined;
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
