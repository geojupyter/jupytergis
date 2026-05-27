import { getLayoutSegmentHeight } from '@/src/features/story/utils/listStoryLayout';
import type { IListStoryLayout } from '@/src/features/story/types/types';

type ListStoryOverlayPaneType = 'markdown' | 'map';

export interface IListStoryOverlayPaneHeightInput {
  type: ListStoryOverlayPaneType;
  segmentIndex: number;
}

type ListStoryOverlayHeightMode = 'at-rest' | 'scroll-drive';

interface IComputeListStoryOverlayHeightParams {
  stageHeight: number;
  layout: IListStoryLayout | null;
  fromPane: IListStoryOverlayPaneHeightInput;
  toPane: IListStoryOverlayPaneHeightInput;
  mode: ListStoryOverlayHeightMode;
  activeSegmentIndex: number;
}

function estimatePaneHeight(
  pane: IListStoryOverlayPaneHeightInput,
  layout: IListStoryLayout | null,
  stageHeight: number,
): number {
  if (pane.type === 'map') {
    return stageHeight;
  }
  return getLayoutSegmentHeight(layout, pane.segmentIndex) ?? stageHeight;
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
  if (mode === 'at-rest') {
    if (toPane.type === 'map') {
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
