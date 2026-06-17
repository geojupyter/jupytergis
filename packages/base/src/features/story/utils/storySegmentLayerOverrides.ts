import type {
  IJGISLayer,
  IJGISLayerItem,
  IJGISLayerTree,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';

import {
  hasMeaningfulGrammarSymbologyState,
  symbologyStatesEqual,
} from '@/src/features/layers/symbology/symbologyUtils';

type LayerOverrideItem = NonNullable<
  IStorySegmentLayer['layerOverride']
>[number];

export interface ISegmentLayerRow {
  layerId: string;
  layerName: string;
  baseVisible: boolean;
  effectiveVisible: boolean;
  baseOpacity: number;
  effectiveOpacity: number;
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

function getBaseVisible(layer: IJGISLayer): boolean {
  return layer.visible ?? true;
}

function getBaseOpacity(layer: IJGISLayer): number {
  return (layer.parameters as { opacity?: number })?.opacity ?? 1;
}

function getLayerSymbologyState(layer: IJGISLayer): unknown {
  return (layer.parameters as { symbologyState?: unknown })?.symbologyState;
}

function shouldPersistSymbologyOverride(
  layer: IJGISLayer,
  symbologyState: LayerOverrideItem['symbologyState'],
): boolean {
  if (!hasMeaningfulGrammarSymbologyState(symbologyState)) {
    return false;
  }

  const baseSymbology = getLayerSymbologyState(layer);
  if (!hasMeaningfulGrammarSymbologyState(baseSymbology)) {
    return true;
  }

  return !symbologyStatesEqual(baseSymbology, symbologyState);
}

function hasStyleOverrideFieldsForLayer(
  layer: IJGISLayer,
  override: LayerOverrideItem,
): boolean {
  if (
    override.opacity !== undefined &&
    override.opacity !== getBaseOpacity(layer)
  ) {
    return true;
  }

  if (shouldPersistSymbologyOverride(layer, override.symbologyState)) {
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

/** Strip override fields that match the base layer; drop entry if nothing remains. */
function normalizeLayerOverride(
  layer: IJGISLayer,
  override: LayerOverrideItem,
): LayerOverrideItem | null {
  const normalized: LayerOverrideItem = {
    targetLayer: override.targetLayer,
  };

  if (
    override.visible !== undefined &&
    override.visible !== getBaseVisible(layer)
  ) {
    normalized.visible = override.visible;
  }

  if (
    override.opacity !== undefined &&
    override.opacity !== getBaseOpacity(layer)
  ) {
    normalized.opacity = override.opacity;
  }

  if (shouldPersistSymbologyOverride(layer, override.symbologyState)) {
    normalized.symbologyState = override.symbologyState;
  }

  if (override.color && Object.keys(override.color).length > 0) {
    normalized.color = override.color;
  }

  if (
    override.sourceProperties &&
    Object.keys(override.sourceProperties).length > 0
  ) {
    normalized.sourceProperties = override.sourceProperties;
  }

  if (
    normalized.visible === undefined &&
    normalized.opacity === undefined &&
    !hasStyleOverrideFieldsForLayer(layer, normalized)
  ) {
    return null;
  }

  return normalized;
}

function upsertLayerOverride(
  overrides: LayerOverrideItem[],
  layer: IJGISLayer,
  targetLayerId: string,
  mutate: (entry: LayerOverrideItem) => LayerOverrideItem,
): LayerOverrideItem[] {
  const index = overrides.findIndex(entry => entry.targetLayer === targetLayerId);
  const draft =
    index >= 0
      ? mutate({ ...overrides[index] })
      : mutate({ targetLayer: targetLayerId });

  const normalized = normalizeLayerOverride(layer, draft);
  const next = [...overrides];

  if (normalized === null) {
    if (index >= 0) {
      next.splice(index, 1);
    }
    return next;
  }

  if (index >= 0) {
    next[index] = normalized;
  } else {
    next.push(normalized);
  }

  return next;
}

export function isLayerOverrideChanged(
  layer: IJGISLayer,
  override: LayerOverrideItem | undefined,
): boolean {
  if (!override) {
    return false;
  }

  return normalizeLayerOverride(layer, override) !== null;
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
    const baseVisible = getBaseVisible(layer);
    const effectiveVisible = override?.visible ?? baseVisible;
    const baseOpacity = getBaseOpacity(layer);
    const effectiveOpacity = override?.opacity ?? baseOpacity;

    return [
      {
        layerId,
        layerName: layer.name,
        baseVisible,
        effectiveVisible,
        baseOpacity,
        effectiveOpacity,
        isChanged: isLayerOverrideChanged(layer, override),
        hasStyleOverride: override
          ? hasStyleOverrideFieldsForLayer(layer, override)
          : false,
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
  const baseVisible = getBaseVisible(targetLayer);
  const layerOverride = upsertLayerOverride(
    [...(parameters.layerOverride ?? [])],
    targetLayer,
    targetLayerId,
    entry => {
      const next = { ...entry };
      if (visible === baseVisible) {
        delete next.visible;
      } else {
        next.visible = visible;
      }
      return next;
    },
  );

  model.sharedModel.updateObjectParameters(segmentId, {
    layerOverride,
  });

  return true;
}

export function setSegmentLayerOpacity(
  model: IJupyterGISModel,
  segmentId: string,
  targetLayerId: string,
  opacity: number,
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
  const baseOpacity = getBaseOpacity(targetLayer);
  const layerOverride = upsertLayerOverride(
    [...(parameters.layerOverride ?? [])],
    targetLayer,
    targetLayerId,
    entry => {
      const next = { ...entry };
      if (opacity === baseOpacity) {
        delete next.opacity;
      } else {
        next.opacity = opacity;
      }
      return next;
    },
  );

  model.sharedModel.updateObjectParameters(segmentId, {
    layerOverride,
  });

  return true;
}

export function resetSegmentLayerOverride(
  model: IJupyterGISModel,
  segmentId: string,
  targetLayerId: string,
): boolean {
  const segment = model.getLayer(segmentId);

  if (!segment || segment.type !== 'StorySegmentLayer') {
    return false;
  }

  const parameters = segment.parameters as IStorySegmentLayer;
  const layerOverride = parameters.layerOverride ?? [];
  const index = layerOverride.findIndex(
    entry => entry.targetLayer === targetLayerId,
  );

  if (index < 0) {
    return false;
  }

  const next = [...layerOverride];
  next.splice(index, 1);

  model.sharedModel.updateObjectParameters(segmentId, {
    layerOverride: next,
  });

  return true;
}
