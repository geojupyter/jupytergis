import {
  IJGISLayer,
  IJupyterGISModel,
  IVectorLayer,
  IWebGlLayer,
} from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import colormap from 'colormap';

import { IColorMap } from './colorRampUtils';
import { IStopRow } from './symbologyDialog';

/**
 * Payload when saving symbology. As of #698, only `symbologyState` is persisted
 * for vector layers — the OpenLayers FlatStyle is derived at render time from
 * `symbologyState` via `styleBuilder.buildVectorFlatStyle`. WebGl layers still
 * accept an optional `color` because their `color` field is used for band-math
 * expressions, not symbology duplication.
 */
export interface ISymbologyPayload {
  symbologyState:
    | IVectorLayer['symbologyState']
    | IWebGlLayer['symbologyState'];
  /**
   * Only used by WebGl band-math (`IWebGlLayer['color']`); never set for
   * vector layers. Typed as `unknown` because the WebGl schema's color type
   * is a nested numeric-array expression that doesn't round-trip cleanly
   * through the JSON-schema generator.
   */
  color?: unknown;
}

export interface ISaveSymbologyOptions {
  model: IJupyterGISModel;
  layerId: string;
  isStorySegmentOverride?: boolean;
  segmentId?: string;
  payload: ISymbologyPayload;
  mutateLayerBeforeSave?: (layer: any) => void;
}

export type VectorSymbologyParams = Pick<
  IVectorLayer,
  'symbologyState' | 'color'
>;

export type WebGlSymbologyParams = Pick<
  IWebGlLayer,
  'symbologyState' | 'color'
>;

/** Params-shaped object used for reading symbology (layer.parameters or segment override). */
export type IEffectiveSymbologyParams =
  | VectorSymbologyParams
  | WebGlSymbologyParams;

/**
 * Resolve the effective symbology params for this dialog: either the layer's
 * parameters or the matching segment override when editing a story-segment override.
 */
export function getEffectiveSymbologyParams(
  model: IJupyterGISModel,
  layerId: string,
  layer: IJGISLayer | null | undefined,
  isStorySegmentOverride?: boolean,
  segmentId?: string,
): IEffectiveSymbologyParams | null {
  if (!layer?.parameters) {
    return null;
  }
  if (!isStorySegmentOverride) {
    return layer.parameters as IEffectiveSymbologyParams;
  }
  if (!segmentId) {
    return null;
  }
  const segment = model.getLayer(segmentId);
  const override = segment?.parameters?.layerOverride?.find(
    (override: { targetLayer?: string }) => override.targetLayer === layerId,
  );

  if (!override.symbologyState) {
    override.symbologyState = {};
  }
  return (override as IEffectiveSymbologyParams) ?? null;
}

export function saveSymbology(options: ISaveSymbologyOptions): void {
  const {
    model,
    layerId,
    isStorySegmentOverride,
    segmentId,
    payload,
    mutateLayerBeforeSave,
  } = options;

  if (!isStorySegmentOverride) {
    const layer = model.getLayer(layerId);
    if (!layer?.parameters) {
      return;
    }

    layer.parameters.symbologyState = payload.symbologyState;
    if (payload.color !== undefined) {
      (layer.parameters as { color?: unknown }).color = payload.color;
    }

    mutateLayerBeforeSave?.(layer);
    model.sharedModel.updateLayer(layerId, layer);
    return;
  }

  if (!segmentId) {
    return;
  }

  const segment = model.getLayer(segmentId);
  if (!segment?.parameters) {
    return;
  }

  if (!segment.parameters.layerOverride) {
    segment.parameters.layerOverride = [];
  }

  // Find the override for the target layer (from the selected layer in the dialog)
  const targetLayerId = model.selected
    ? Object.keys(model.selected).find(
        id =>
          id !== segmentId && model.getLayer(id)?.type !== 'StorySegmentLayer',
      )
    : undefined;

  if (!targetLayerId) {
    return;
  }

  const overrides = segment.parameters.layerOverride;
  let override = overrides.find(
    (override: any) => override.targetLayer === targetLayerId,
  );

  if (!override) {
    // Create new override entry
    override = {
      targetLayer: targetLayerId,
      visible: true,
      opacity: 1,
    };
    overrides.push(override);
  }

  override.symbologyState = payload.symbologyState;
  if (payload.color !== undefined) {
    override.color = payload.color;
  }

  model.sharedModel.updateLayer(segmentId, segment);
}
export namespace VectorUtils {
  /**
   * Load color stop rows from `symbologyState.stops`. Each persisted stop
   * is a plain `{value, color}`; dialogs expect `{id, stop, output}` for
   * their UI state, so we rehydrate that shape here.
   */
  export const buildColorInfo = (params: VectorSymbologyParams): IStopRow[] => {
    const stops = params?.symbologyState?.stops ?? [];
    return stops.map(s => ({
      id: UUID.uuid4(),
      stop: s.value as IStopRow['stop'],
      output: s.color as IStopRow['output'],
    }));
  };

  /**
   * Load radius stop rows from `symbologyState.radiusStops`.
   */
  export const buildRadiusInfo = (layer: IJGISLayer): IStopRow[] => {
    const radiusStops =
      (layer.parameters as IVectorLayer | undefined)?.symbologyState
        ?.radiusStops ?? [];
    return radiusStops
      .filter(s => s.value !== undefined && s.radius !== undefined)
      .map(s => ({
        id: UUID.uuid4(),
        stop: s.value as number,
        output: s.radius as number,
      }));
  };
}

export namespace Utils {
  export const getValueColorPairs = (
    stops: number[],
    colorRamp: IColorMap,
    nClasses: number,
    reverse = false,
  ) => {
    const isCategorical = colorRamp.type === 'categorical';

    let colorMap: any[];

    if (isCategorical) {
      colorMap = [...colorRamp.colors];

      if (colorMap.length < nClasses) {
        colorMap = Array.from({ length: nClasses }, (_, i) => {
          return colorMap[i % colorMap.length];
        });
      } else {
        colorMap = colorMap.slice(0, nClasses);
      }
    } else {
      const nShades = Math.max(nClasses, 9);

      colorMap = colormap({
        colormap: colorRamp.name,
        nshades: nShades,
        format: 'rgba',
      });
    }

    if (reverse) {
      colorMap = [...colorMap].reverse();
    }

    const valueColorPairs: IStopRow[] = [];

    for (let i = 0; i < nClasses; i++) {
      const colorIndex = isCategorical
        ? i
        : Math.round((i / (nClasses - 1)) * (colorMap.length - 1));
      valueColorPairs.push({
        id: UUID.uuid4(),
        stop: stops[i],
        output: colorMap[colorIndex],
      });
    }

    return valueColorPairs;
  };
}
