import type { IJGISStoryMap } from '@jupytergis/schema';

import { STORY_TYPE } from '@/src/types';

export function isVerticalScrollStory(
  storyType: IJGISStoryMap['storyType'] | undefined,
): boolean {
  return storyType === STORY_TYPE.verticalScroll;
}

export function isColumnStory(
  storyType: IJGISStoryMap['storyType'] | undefined,
): boolean {
  return !isVerticalScrollStory(storyType);
}
