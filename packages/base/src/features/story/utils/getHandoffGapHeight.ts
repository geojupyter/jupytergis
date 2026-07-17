import type { StorySegmentDisplayMode } from '@/src/features/story/types/types';

/**
 * Height of the handoff gap between two list-story segments.
 * Map-adjacent transitions always use the full stage height.
 * markdown-only transitions use it only when markdownSegmentGap is enabled.
 */
export function getHandoffGapHeight(
  fromMode: StorySegmentDisplayMode,
  toMode: StorySegmentDisplayMode,
  mapHeight: number,
  markdownSegmentGap: boolean,
): number {
  if (fromMode === 'map' || toMode === 'map') {
    return mapHeight;
  }

  return markdownSegmentGap ? mapHeight : 0;
}
