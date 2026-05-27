import type { IJupyterGISModel } from '@jupytergis/schema';

import { getSegmentDisplayMode } from '@/src/features/story/utils/segmentDisplayMode';
import {
  buildStorySegmentViewItems,
  type IStorySegmentViewItem,
} from '@/src/features/story/utils/storySegmentViewItems';

export interface IListStoryMarkdownSegment {
  id: string;
  index: number;
  markdown: string;
}

export function getStoryMarkdownFromSlide(
  activeSlide: IStorySegmentViewItem['activeSlide'],
): string {
  const markdown = activeSlide?.content?.markdown;
  return typeof markdown === 'string' ? markdown : '';
}

export function getListStoryMarkdownSegmentsFromItems(
  items: IStorySegmentViewItem[],
): IListStoryMarkdownSegment[] {
  return items
    .filter(item => getSegmentDisplayMode(item.activeSlide) === 'markdown')
    .map(item => ({
      id: item.id,
      index: item.index,
      markdown: getStoryMarkdownFromSlide(item.activeSlide),
    }));
}

export function getListStoryMarkdownSegments(
  model: IJupyterGISModel,
): IListStoryMarkdownSegment[] {
  const story = model.getSelectedStory().story ?? null;
  return getListStoryMarkdownSegmentsFromItems(
    buildStorySegmentViewItems(model, story),
  );
}
