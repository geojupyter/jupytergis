import type { IStorySegmentLayer } from '@jupytergis/schema';

import type { StorySegmentDisplayMode } from '@/src/features/story/types/listStoryScrollDrive';

export function getSegmentDisplayMode(
  activeSlide: IStorySegmentLayer['parameters'] | undefined,
): StorySegmentDisplayMode {
  if (activeSlide?.content?.contentMode === 'markdown') {
    return 'markdown';
  }
  return 'map';
}

export function pairNeedsScrollDrive(
  _fromMode: StorySegmentDisplayMode,
  _toMode: StorySegmentDisplayMode,
): boolean {
  return true;
}
