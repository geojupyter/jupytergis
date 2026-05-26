import { useMemo } from 'react';

import { getLayoutSegmentHeight } from '@/src/features/story/context/ListStoryLayoutContext';
import type { IListStoryLayout } from '@/src/features/story/utils/listStoryLayout';

export type ListStoryOverlayPaneKind = 'inactive' | 'markdown' | 'map';

export interface IListStoryOverlayPaneSpec {
  kind: ListStoryOverlayPaneKind;
  segmentIndex: number;
}

export type ListStoryOverlayHeightMode =
  | 'hidden'
  | 'idle-markdown'
  | 'map-at-rest'
  | 'scroll-drive';

export interface IUseListStoryOverlayHeightParams {
  stageHeight: number;
  layout: IListStoryLayout | null;
  fromPane: IListStoryOverlayPaneSpec | null;
  toPane: IListStoryOverlayPaneSpec | null;
  mode: ListStoryOverlayHeightMode;
  activeSegmentIndex: number;
}

function estimatePaneHeight(
  spec: IListStoryOverlayPaneSpec,
  layout: IListStoryLayout | null,
  stageHeight: number,
): number {
  if (spec.kind === 'inactive') {
    return 0;
  }
  if (spec.kind === 'map') {
    return stageHeight;
  }
  return getLayoutSegmentHeight(layout, spec.segmentIndex) ?? stageHeight;
}

function estimatePaneContribution(
  spec: IListStoryOverlayPaneSpec | null,
  layout: IListStoryLayout | null,
  stageHeight: number,
): number {
  if (!spec || spec.kind === 'inactive') {
    return 0;
  }
  return estimatePaneHeight(spec, layout, stageHeight);
}

/**
 * Overlay height from virtual-track layout (no live DOM measure).
 * Scroll-drive: sum of from + to segment heights; idle markdown: one segment.
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
    if (mode === 'idle-markdown') {
      const segment =
        getLayoutSegmentHeight(layout, activeSegmentIndex) ?? floor;
      return Math.max(floor, segment);
    }
    if (mode === 'map-at-rest') {
      return floor;
    }
    console.log('from pane', estimatePaneContribution(fromPane, layout, floor));
    console.log('to pane', estimatePaneContribution(toPane, layout, floor));
    const sum =
      estimatePaneContribution(fromPane, layout, floor) +
      estimatePaneContribution(toPane, layout, floor);
    if (sum <= 0) {
      return floor;
    }
    return Math.max(floor, sum);
  }, [stageHeight, layout, fromPane, toPane, mode, activeSegmentIndex]);
}
