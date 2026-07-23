import type { IJGISStoryMap } from '@jupytergis/schema';

import type { StoryPresentationMode } from '@/src/features/story/presentation/types';
import { STORY_TYPE } from '@/src/types';

/**
 * Resolve presentation layout from story type.
 */
export function getStoryPresentationMode(
  storyType: IJGISStoryMap['storyType'] | undefined,
): StoryPresentationMode {
  if (storyType === STORY_TYPE.verticalScroll) {
    return 'verticalScroll';
  }

  return 'column';
}

export function isVerticalScrollPresentation(
  mode: StoryPresentationMode,
): boolean {
  return mode === 'verticalScroll';
}

export function isColumnPresentation(mode: StoryPresentationMode): boolean {
  return mode === 'column';
}
