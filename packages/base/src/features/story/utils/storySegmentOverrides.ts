import type { IJupyterGISModel, IStorySegmentLayer } from '@jupytergis/schema';

import type { IOverrideLayerEntry } from '@/src/features/story/types/types';

export function applySegmentLayerOverrides(
  model: IJupyterGISModel,
  segmentId: string,
  entries: IOverrideLayerEntry[],
): void {
  const segment = model.getLayer(segmentId);
  const layerOverrides = (
    segment?.parameters as IStorySegmentLayer['parameters'] | undefined
  )?.layerOverride;

  if (!Array.isArray(layerOverrides)) {
    return;
  }

  layerOverrides.forEach(override => {
    const {
      color,
      opacity,
      sourceProperties,
      symbologyState,
      targetLayer: targetLayerId,
      visible,
    } = override;

    if (!targetLayerId) {
      return;
    }

    entries.push({
      layerId: targetLayerId,
      action: 'restore',
    });

    const targetLayer = model.getLayer(targetLayerId);

    if (!targetLayer?.parameters) {
      return;
    }

    if (symbologyState !== undefined) {
      targetLayer.parameters.symbologyState = symbologyState;
    }
    if (color !== undefined) {
      (targetLayer.parameters as { color?: unknown }).color = color;
    }
    if (opacity !== undefined) {
      targetLayer.parameters.opacity = opacity;
    }
    if (visible !== undefined) {
      targetLayer.visible = visible;
    }

    if (
      sourceProperties !== undefined &&
      Object.keys(sourceProperties).length > 0
    ) {
      const sourceId = targetLayer.parameters?.source;
      if (!sourceId) {
        return;
      }

      const source = model.getSource(sourceId);
      if (!source?.parameters) {
        return;
      }

      source.parameters = {
        ...source.parameters,
        ...sourceProperties,
      };

      entries.push({
        layerId: sourceId,
        action: 'restore',
      });

      model.triggerLayerUpdate(sourceId, source);
    }

    model.triggerLayerUpdate(targetLayerId, targetLayer);
  });
}

export function clearSegmentLayerOverrideEntries(
  model: IJupyterGISModel,
  entries: IOverrideLayerEntry[],
  removeLayer?: (id: string) => void,
): void {
  entries.forEach(({ layerId, action }) => {
    if (action === 'remove') {
      removeLayer?.(layerId);
      return;
    }

    const layerOrSource = model.getLayerOrSource(layerId);
    if (layerOrSource) {
      model.triggerLayerUpdate(layerId, layerOrSource);
    }
  });
  entries.length = 0;
}
