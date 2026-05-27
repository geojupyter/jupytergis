import type { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import { useMemo } from 'react';

import {
  buildStorySegmentViewItems,
  type IStorySegmentViewItem,
} from '@/src/features/story/utils/storySegmentViewItems';

export type { IStorySegmentViewItem };

interface IUseStorySegmentViewItemsParams {
  model: IJupyterGISModel;
  storyData: IJGISStoryMap | null;
}

export function useStorySegmentViewItems({
  model,
  storyData,
}: IUseStorySegmentViewItemsParams): IStorySegmentViewItem[] {
  return useMemo(
    () => buildStorySegmentViewItems(model, storyData),
    [model, storyData],
  );
}
