import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { useMemo, useRef } from 'react';

import {
  getEffectiveSymbologyParams,
  type IEffectiveSymbologyParams,
} from '../symbologyUtils';

export interface IUseEffectiveSymbologyParamsArgs {
  model: IJupyterGISModel;
  layerId: string | undefined;
  layer: IJGISLayer | null | undefined;
  isStorySegmentOverride?: boolean;
  segmentId?: string;
}

/**
 * Resolve the effective symbology params (layer.parameters or segment override)
 * for the current dialog context. Pass a type parameter to narrow the return
 * type for the layer kind this component uses (e.g. VectorSymbologyParams for
 * vector symbology components).
 */
export function useEffectiveSymbologyParams<
  T extends IEffectiveSymbologyParams = IEffectiveSymbologyParams,
>({
  model,
  layerId,
  layer,
  isStorySegmentOverride,
  segmentId,
}: IUseEffectiveSymbologyParamsArgs): T | null {
  const result = useMemo(() => {
    if (!layerId || !layer) {
      return null;
    }
    return getEffectiveSymbologyParams(
      model,
      layerId,
      layer,
      isStorySegmentOverride,
      segmentId,
    );
  }, [model, layerId, layer, isStorySegmentOverride, segmentId]);

  // Stabilize reference
  const prevRef = useRef<{
    value: IEffectiveSymbologyParams | null;
    serialized: string;
  }>({ value: null, serialized: '' });
  const serialized = result === null ? '' : JSON.stringify(result);
  if (serialized === prevRef.current.serialized) {
    return prevRef.current.value as T | null;
  }
  prevRef.current = { value: result, serialized };
  return result as T | null;
}
