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

export function computeListStoryOverlayHeight({
  stageHeight,
  layout,
  toPane,
  mode,
  activeSegmentIndex,
}: IComputeListStoryOverlayHeightParams): number {
  const floor = Math.max(stageHeight, 0);

  // Scroll-drive transforms move panes by one overlay-height over progress 0→1.
  // That unit must be one stage viewport, not the sum of pane content heights.
  if (mode === 'scroll-drive') {
    return floor;
  }

  if (toPane.type === 'map') {
    return floor;
  }

  const segment = getLayoutSegmentHeight(layout, activeSegmentIndex) ?? floor;
  return Math.max(floor, segment);
}
