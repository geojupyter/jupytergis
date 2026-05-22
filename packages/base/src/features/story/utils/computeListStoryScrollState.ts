import type { IListStoryScrollDrivePayload } from '@/src/features/story/types/listStoryScrollDrive';

import type { IListStorySegmentRange } from './listStoryLayout';
import { pairNeedsScrollDrive } from './segmentDisplayMode';

export interface IListStoryScrollState {
  activeIndex: number;
  drive: IListStoryScrollDrivePayload | null;
}

export interface IComputeListStoryScrollInput {
  scrollCenter: number;
  segments: IListStorySegmentRange[];
  prev: IListStoryScrollState | null;
}

function findPairIndex(
  scrollCenter: number,
  segments: IListStorySegmentRange[],
): number {
  if (segments.length < 2) {
    return 0;
  }

  if (scrollCenter < segments[0].start) {
    return 0;
  }

  const last = segments[segments.length - 1];
  if (scrollCenter >= last.end) {
    return segments.length - 2;
  }

  for (let i = 0; i < segments.length - 1; i++) {
    if (scrollCenter < segments[i + 1].end) {
      return i;
    }
  }

  return segments.length - 2;
}

/** Pure list-scroll geometry from virtual track segment ranges. */
export function computeListStoryScrollState({
  scrollCenter,
  segments,
  prev,
}: IComputeListStoryScrollInput): IListStoryScrollState | null {
  if (!segments.length) {
    return null;
  }

  if (segments.length === 1) {
    return {
      activeIndex: segments[0].index,
      drive: null,
    };
  }

  const pairIndex = findPairIndex(scrollCenter, segments);
  const fromSegment = segments[pairIndex];
  const toSegment = segments[pairIndex + 1];
  const spanStart = fromSegment.start;
  const spanEnd = toSegment.end;
  const span = spanEnd - spanStart;

  if (span <= 0) {
    return prev;
  }

  const progress = Math.min(1, Math.max(0, (scrollCenter - spanStart) / span));
  const activeIndex = progress >= 0.5 ? toSegment.index : fromSegment.index;

  const drive = pairNeedsScrollDrive(
    fromSegment.contentMode,
    toSegment.contentMode,
  )
    ? {
        progress,
        fromIndex: fromSegment.index,
        toIndex: toSegment.index,
        fromMode: fromSegment.contentMode,
        toMode: toSegment.contentMode,
      }
    : null;

  return { activeIndex, drive };
}
