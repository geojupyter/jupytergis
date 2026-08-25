import { extend } from 'ol/extent';
import type BaseLayer from 'ol/layer/Base';
import type { Layer } from 'ol/layer';
import type LayerGroup from 'ol/layer/Group';
import type Projection from 'ol/proj/Projection';
import { transformExtent } from 'ol/proj';
import type { Source } from 'ol/source';

export function isValidExtent(
  extent: number[] | undefined,
): extent is number[] {
  return !!extent && extent.every(value => Number.isFinite(value));
}

export function transformExtentToViewProjection(
  extent: number[],
  viewProjection: Projection,
  sourceProjection?: Projection | null,
): number[] {
  if (
    sourceProjection &&
    sourceProjection.getCode() !== viewProjection.getCode()
  ) {
    return transformExtent(extent, sourceProjection, viewProjection);
  }

  return extent;
}

function isLayerGroup(layer: BaseLayer): layer is LayerGroup {
  return 'getLayers' in layer;
}

function isLayer(layer: BaseLayer): layer is Layer {
  return 'getSource' in layer && !('getLayers' in layer);
}

/** Union extent of an OL layer or nested layer group in view projection. */
export function getZoomExtentForOlLayer(
  olLayer: Layer | LayerGroup,
  viewProjection: Projection,
  computeExtent: (
    layer: Layer,
    source: Source | null,
  ) => number[] | undefined,
): number[] | undefined {
  const stack: BaseLayer[] = [olLayer];
  let combined: number[] | undefined;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (isLayerGroup(current)) {
      stack.push(...current.getLayers().getArray());
      continue;
    }

    if (!isLayer(current)) {
      continue;
    }

    const source = current.getSource();
    const extent = computeExtent(current, source);
    if (!isValidExtent(extent)) {
      continue;
    }

    const transformed = transformExtentToViewProjection(
      extent,
      viewProjection,
      source?.getProjection(),
    );
    if (!isValidExtent(transformed)) {
      continue;
    }

    if (!combined) {
      combined = [...transformed];
    } else {
      extend(combined, transformed);
    }
  }

  return combined;
}
