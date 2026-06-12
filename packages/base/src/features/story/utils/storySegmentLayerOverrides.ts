import type {
  IJGISLayer,
  IJGISLayerItem,
  IJGISLayerTree,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';

type LayerOverrideItem = NonNullable<IStorySegmentLayer['layerOverride']>[number];

export interface ISegmentLayerRow {
  layerId: string;
  layerName: string;
  baseVisible: boolean;
  effectiveVisible: boolean;
  isChanged: boolean;
  hasStyleOverride: boolean;
}

function visitMapLayerIds(
  items: IJGISLayerTree,
  model: IJupyterGISModel,
  layerIds: string[],
): void {
  for (const item of items) {
    if (typeof item === 'string') {
      const layer = model.getLayer(item);
      if (layer?.type !== 'StorySegmentLayer') {
        layerIds.push(item);
      }
      continue;
    }

    visitMapLayerIds(item.layers, model, layerIds);
  }
}

export function getMapLayerIds(model: IJupyterGISModel): string[] {
  const layerIds: string[] = [];
  visitMapLayerIds(model.getLayerTree(), model, layerIds);
  return layerIds;
}

export function getLayerOverrideEntry(
  overrides: IStorySegmentLayer['layerOverride'] | undefined,
  targetLayerId: string,
): LayerOverrideItem | undefined {
  return overrides?.find(entry => entry.targetLayer === targetLayerId);
}

function hasStyleOverrideFields(override: LayerOverrideItem): boolean {
  if (override.opacity !== undefined) {
    return true;
  }

  if (override.symbologyState && Object.keys(override.symbologyState).length > 0) {
    return true;
  }

  if (override.color && Object.keys(override.color).length > 0) {
    return true;
  }

  if (
    override.sourceProperties &&
    Object.keys(override.sourceProperties).length > 0
  ) {
    return true;
  }

  return false;
}

export function isLayerOverrideChanged(
  layer: IJGISLayer,
  override: LayerOverrideItem | undefined,
): boolean {
  if (!override) {
    return false;
  }

  const baseVisible = layer.visible ?? true;
  const baseOpacity = (layer.parameters as { opacity?: number })?.opacity ?? 1;

  if (override.visible !== undefined && override.visible !== baseVisible) {
    return true;
  }

  if (override.opacity !== undefined && override.opacity !== baseOpacity) {
    return true;
  }

  return hasStyleOverrideFields(override);
}

function isRedundantOverride(
  layer: IJGISLayer,
  override: LayerOverrideItem,
): boolean {
  const baseVisible = layer.visible ?? true;

  if (override.visible !== undefined && override.visible !== baseVisible) {
    return false;
  }

  if (override.opacity !== undefined) {
    const baseOpacity = (layer.parameters as { opacity?: number })?.opacity ?? 1;
    if (override.opacity !== baseOpacity) {
      return false;
    }
  }

  return !hasStyleOverrideFields(override);
}

export function buildSegmentLayerRows(
  model: IJupyterGISModel,
  segmentId: string,
): ISegmentLayerRow[] {
  const segment = model.getLayer(segmentId);
  const overrides =
    segment?.type === 'StorySegmentLayer'
      ? (segment.parameters as IStorySegmentLayer).layerOverride
      : undefined;

  return getMapLayerIds(model).flatMap(layerId => {
    const layer = model.getLayer(layerId);
    if (!layer) {
      return [];
    }

    const override = getLayerOverrideEntry(overrides, layerId);
    const baseVisible = layer.visible ?? true;
    const effectiveVisible = override?.visible ?? baseVisible;

    return [
      {
        layerId,
        layerName: layer.name,
        baseVisible,
        effectiveVisible,
        isChanged: isLayerOverrideChanged(layer, override),
        hasStyleOverride: hasStyleOverrideFields(override ?? {}),
      },
    ];
  });
}

export function setSegmentLayerVisibility(
  model: IJupyterGISModel,
  segmentId: string,
  targetLayerId: string,
  visible: boolean,
): boolean {
  const segment = model.getLayer(segmentId);
  const targetLayer = model.getLayer(targetLayerId);

  if (
    !segment ||
    segment.type !== 'StorySegmentLayer' ||
    !targetLayer ||
    targetLayer.type === 'StorySegmentLayer'
  ) {
    return false;
  }

  const parameters = segment.parameters as IStorySegmentLayer;
  const overrides = [...(parameters.layerOverride ?? [])];
  const index = overrides.findIndex(entry => entry.targetLayer === targetLayerId);
  const baseVisible = targetLayer.visible ?? true;

  if (visible === baseVisible) {
    if (index >= 0) {
      const nextEntry = { ...overrides[index] };
      delete nextEntry.visible;

      if (isRedundantOverride(targetLayer, nextEntry)) {
        overrides.splice(index, 1);
      } else {
        overrides[index] = nextEntry;
      }
    }
  } else if (index >= 0) {
    overrides[index] = { ...overrides[index], visible };
  } else {
    overrides.push({ targetLayer: targetLayerId, visible });
  }

  model.sharedModel.updateObjectParameters(segmentId, {
    layerOverride: overrides,
  });

  return true;
}
