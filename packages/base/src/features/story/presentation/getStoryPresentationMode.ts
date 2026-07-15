import type { IJGISStoryMap } from '@jupytergis/schema';

import type { StoryPresentationMode } from '@/src/features/story/presentation/types';
import { STORY_TYPE } from '@/src/types';

/**
 * Resolve presentation layout from story type.
 * Unguided is treated as column until removed from schema/UI.
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
