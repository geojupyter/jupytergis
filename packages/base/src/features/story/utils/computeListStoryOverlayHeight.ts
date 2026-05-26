import { getLayoutSegmentHeight } from '@/src/features/story/context/ListStoryLayoutContext';
import type { IListStoryLayout } from '@/src/features/story/utils/listStoryLayout';

export type ListStoryOverlayPaneKind = 'markdown' | 'map';

export interface IListStoryOverlayPaneSpec {
  kind: ListStoryOverlayPaneKind;
  segmentIndex: number;
}

export type ListStoryOverlayHeightMode = 'hidden' | 'at-rest' | 'scroll-drive';

export interface IComputeListStoryOverlayHeightParams {
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

/**
 * Overlay height from virtual-track layout (no live DOM measure).
 * Scroll-drive: sum of from + to; at rest: single visible segment (to pane).
 */
export function computeListStoryOverlayHeight({
  stageHeight,
  layout,
  fromPane,
  toPane,
  mode,
  activeSegmentIndex,
}: IComputeListStoryOverlayHeightParams): number {
  const floor = Math.max(stageHeight, 0);
  if (mode === 'hidden') {
    return floor;
  }
  if (mode === 'at-rest') {
    if (toPane.kind === 'map') {
      return floor;
    }
    const segment = getLayoutSegmentHeight(layout, activeSegmentIndex) ?? floor;
    return Math.max(floor, segment);
  }
  const sum =
    estimatePaneHeight(fromPane, layout, floor) +
    estimatePaneHeight(toPane, layout, floor);
  if (sum <= 0) {
    return floor;
  }
  return Math.max(floor, sum);
}
