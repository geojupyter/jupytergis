import {
  IJGISLayer,
  IJupyterGISModel,
  IVectorLayer,
  IWebGlLayer,
} from '@jupytergis/schema';
import colormap from 'colormap';

import { ColorRampName } from '@/src/types';
import { VectorClassifications } from './classificationModes';
import { IStopRow } from './symbologyDialog';

const COLOR_EXPR_STOPS_START = 3;

/** Payload when saving symbology; shape matches vector or WebGl layer params. */
export interface ISymbologyPayload {
  symbologyState:
    | IVectorLayer['symbologyState']
    | IWebGlLayer['symbologyState'];
  color?: IVectorLayer['color'] | IWebGlLayer['color'];
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
      layer.parameters.color = payload.color;
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
  export const buildColorInfo = (layerParamers: VectorSymbologyParams) => {
    // This it to parse a color object on the layer
    if (!layerParamers?.color) {
      return [];
    }

    const color = layerParamers.color;

    // If color is a string we don't need to parse
    if (typeof color === 'string') {
      return [];
    }

    const keys = ['fill-color', 'circle-fill-color'];
    const valueColorPairs: IStopRow[] = [];
    const seenPairs = new Set<string>();

    for (const key of keys) {
      if (!color[key]) {
        continue;
      }

      switch (color[key][0]) {
        case 'interpolate':
          // First element is interpolate for linear selection
          // Second element is type of interpolation (ie linear)
          // Third is input value that stop values are compared with
          // Fourth and on is value:color pairs
          for (let i = COLOR_EXPR_STOPS_START; i < color[key].length; i += 2) {
            const pairKey = `${color[key][i]}-${color[key][i + 1]}`;
            if (!seenPairs.has(pairKey)) {
              valueColorPairs.push({
                stop: color[key][i],
                output: color[key][i + 1],
              });
              seenPairs.add(pairKey);
            }
          }
          break;

        case 'case':
          for (let i = 1; i < color[key].length - 1; i += 2) {
            const pairKey = `${color[key][i][2]}-${color[key][i + 1]}`;
            if (!seenPairs.has(pairKey)) {
              valueColorPairs.push({
                stop: color[key][i][2],
                output: color[key][i + 1],
              });
              seenPairs.add(pairKey);
            }
          }
          break;
      }
    }

    return valueColorPairs;
  };

  export const buildRadiusInfo = (layer: IJGISLayer) => {
    if (!layer.parameters?.color) {
      return [];
    }

    const color = layer.parameters.color;

    // If color is a string we don't need to parse
    if (typeof color === 'string') {
      return [];
    }

    const stopOutputPairs: IStopRow[] = [];

    const circleRadius = color['circle-radius'];

    if (
      !Array.isArray(circleRadius) ||
      circleRadius.length <= COLOR_EXPR_STOPS_START
    ) {
      return [];
    }

    for (let i = COLOR_EXPR_STOPS_START; i < circleRadius.length; i += 2) {
      const obj: IStopRow = {
        stop: circleRadius[i],
        output: circleRadius[i + 1],
      };
      stopOutputPairs.push(obj);
    }

    return stopOutputPairs;
  };
}

export namespace Utils {
  export const getValueColorPairs = (
    stops: number[],
    selectedRamp: ColorRampName,
    nClasses: number,
    reverse = false,
    renderType:
      | 'Categorized'
      | 'Graduated'
      | 'Heatmap'
      | 'Singleband Pseudocolor',
    minValue: number,
    maxValue: number,
  ) => {
    let effectiveStops: number[] = [];

    if (stops && stops.length > 0) {
      effectiveStops = stops.map(v => parseFloat(v.toFixed(2)));
    } else {
      effectiveStops = VectorClassifications.calculateEqualIntervalBreaks(
        nClasses,
        minValue,
        maxValue,
      ).map(v => parseFloat(v.toFixed(2)));
    }

    let colorMap = colormap({
      colormap: selectedRamp,
      nshades: nClasses > 9 ? nClasses : 9,
      format: 'rgba',
    });

    if (reverse) {
      colorMap = [...colorMap].reverse();
    }

    const valueColorPairs: IStopRow[] = [];

    // colormap requires 9 classes to generate the ramp
    // so we do some tomfoolery to make it work with less than 9 stops
    if (nClasses < 9) {
      const midIndex = Math.floor(nClasses / 2);

      // Get the first n/2 elements from the second array
      const firstPart = colorMap.slice(0, midIndex);

      // Get the last n/2 elements from the second array
      const secondPart = colorMap.slice(
        colorMap.length - (effectiveStops.length - firstPart.length),
      );

      // Create the new array by combining the first and last parts
      colorMap = firstPart.concat(secondPart);
    }

    for (let i = 0; i < nClasses; i++) {
      valueColorPairs.push({ stop: effectiveStops[i], output: colorMap[i] });
    }

    return valueColorPairs;
  };
}
