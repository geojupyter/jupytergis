import { useMemo } from 'react';

import { getLayoutSegmentHeight } from '@/src/features/story/context/ListStoryLayoutContext';
import type { IListStoryLayout } from '@/src/features/story/utils/listStoryLayout';

export type ListStoryOverlayPaneKind = 'markdown' | 'map';

export interface IListStoryOverlayPaneSpec {
  kind: ListStoryOverlayPaneKind;
  segmentIndex: number;
}

export type ListStoryOverlayHeightMode = 'hidden' | 'at-rest' | 'scroll-drive';

export interface IUseListStoryOverlayHeightParams {
  stageHeight: number;
  layout: IListStoryLayout | null;
  fromPane: IListStoryOverlayPaneSpec;
  toPane: IListStoryOverlayPaneSpec;
  mode: ListStoryOverlayHeightMode;
  activeSegmentIndex: number;
}

function estimatePaneHeight(
  spec: IListStoryOverlayPaneSpec,
  layout: IListStoryLayout | null,
  stageHeight: number,
): number {
  if (spec.kind === 'map') {
    return stageHeight;
  }
  return getLayoutSegmentHeight(layout, spec.segmentIndex) ?? stageHeight;
}

function estimatePaneContribution(
  spec: IListStoryOverlayPaneSpec,
  layout: IListStoryLayout | null,
  stageHeight: number,
): number {
  return estimatePaneHeight(spec, layout, stageHeight);
}

/**
 * Overlay height from virtual-track layout (no live DOM measure).
 * Scroll-drive: sum of from + to; at rest: single visible segment (to pane).
 */
export function useListStoryOverlayHeight({
  stageHeight,
  layout,
  fromPane,
  toPane,
  mode,
  activeSegmentIndex,
}: IUseListStoryOverlayHeightParams): number {
  return useMemo(() => {
    const floor = Math.max(stageHeight, 0);
    if (mode === 'hidden') {
      return floor;
    }
    if (mode === 'at-rest') {
      const segment =
        getLayoutSegmentHeight(layout, activeSegmentIndex) ?? floor;
      if (toPane.kind === 'map') {
        return floor;
      }
      return Math.max(floor, segment);
    }
    const sum =
      estimatePaneContribution(fromPane, layout, floor) +
      estimatePaneContribution(toPane, layout, floor);
    if (sum <= 0) {
      return floor;
    }
    return Math.max(floor, sum);
  }, [stageHeight, layout, fromPane, toPane, mode, activeSegmentIndex]);
}
