import {
  IJGISLayer,
  IJupyterGISModel,
  IVectorLayer,
  IWebGlLayer,
} from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import colormap from 'colormap';

import {
  ColorRampName,
  findExprNode,
  D3SchemeName,
  D3_CATEGORICAL_SCHEMES,
} from './colorRampUtils';
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

      const interpolate = findExprNode(color[key], 'interpolate');
      if (interpolate) {
        // Graduated: value:color pairs starting at index 3
        for (let i = COLOR_EXPR_STOPS_START; i < interpolate.length; i += 2) {
          const pairKey = `${interpolate[i]}-${interpolate[i + 1]}`;
          if (!seenPairs.has(pairKey)) {
            valueColorPairs.push({
              id: UUID.uuid4(),
              stop: interpolate[i] as number,
              output: interpolate[i + 1] as IStopRow['output'],
            });
            seenPairs.add(pairKey);
          }
        }
      } else {
        const caseExpr = findExprNode(color[key], 'case');
        if (caseExpr) {
          // Categorized: alternating [condition, color] pairs, last element is fallback
          for (let i = 1; i < caseExpr.length - 1; i += 2) {
            const condition = caseExpr[i] as unknown[];
            const pairKey = `${condition[2]}-${caseExpr[i + 1]}`;
            if (!seenPairs.has(pairKey)) {
              valueColorPairs.push({
                id: UUID.uuid4(),
                stop: condition[2] as IStopRow['stop'],
                output: caseExpr[i + 1] as IStopRow['output'],
              });
              seenPairs.add(pairKey);
            }
          }
        }
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
        id: UUID.uuid4(),
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
  ) => {
    const isD3Scheme = selectedRamp in D3_CATEGORICAL_SCHEMES;

    let colorMap: any[];

    if (isD3Scheme) {
      colorMap = [...D3_CATEGORICAL_SCHEMES[selectedRamp as D3SchemeName]];

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
        colormap: selectedRamp,
        nshades: nShades,
        format: 'rgba',
      });
    }

    if (reverse) {
      colorMap = [...colorMap].reverse();
    }

    const valueColorPairs: IStopRow[] = [];

    for (let i = 0; i < nClasses; i++) {
      const colorIndex = isD3Scheme
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
