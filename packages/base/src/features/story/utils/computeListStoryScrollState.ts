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

interface IPairDriveResult {
  inZone: boolean;
  progress: number;
  activeIndex: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function segmentProgress(
  scrollCenter: number,
  start: number,
  height: number,
): number | null {
  if (height <= 0) {
    return null;
  }
  return clamp01((scrollCenter - start) / height);
}

function findSegmentAt(
  scrollCenter: number,
  segments: IListStorySegmentRange[],
): IListStorySegmentRange {
  if (scrollCenter < segments[0].start) {
    return segments[0];
  }

  for (const segment of segments) {
    if (scrollCenter >= segment.start && scrollCenter < segment.end) {
      return segment;
    }
  }

  return segments[segments.length - 1];
}

/**
 * Scroll-drive progress is measured only across the segment that owns the
 * transition (markdown target for map→markdown, markdown source for markdown→map).
 */
function computePairDrive(
  scrollCenter: number,
  fromSegment: IListStorySegmentRange,
  toSegment: IListStorySegmentRange,
): IPairDriveResult | null {
  const fromMode = fromSegment.contentMode;
  const toMode = toSegment.contentMode;

  if (fromMode === 'map' && toMode === 'markdown') {
    if (scrollCenter < toSegment.start) {
      return null;
    }
    const progress = segmentProgress(
      scrollCenter,
      toSegment.start,
      toSegment.height,
    );
    if (progress === null) {
      return null;
    }
    if (scrollCenter >= toSegment.end) {
      return null;
    }
    return {
      inZone: true,
      progress,
      activeIndex: progress >= 0.5 ? toSegment.index : fromSegment.index,
    };
  }

  if (fromMode === 'markdown' && toMode === 'map') {
    if (scrollCenter >= toSegment.start) {
      return null;
    }
    if (scrollCenter < fromSegment.start) {
      return null;
    }
    const progress = segmentProgress(
      scrollCenter,
      fromSegment.start,
      fromSegment.height,
    );
    if (progress === null) {
      return null;
    }
    if (scrollCenter >= fromSegment.end) {
      return {
        inZone: true,
        progress: 1,
        activeIndex: toSegment.index,
      };
    }
    return {
      inZone: true,
      progress,
      activeIndex: progress >= 0.5 ? toSegment.index : fromSegment.index,
    };
  }

  if (fromMode === 'markdown' && toMode === 'markdown') {
    const span = toSegment.end - fromSegment.start;
    if (span <= 0) {
      return null;
    }
    if (scrollCenter < fromSegment.start) {
      return null;
    }
    const progress = clamp01((scrollCenter - fromSegment.start) / span);
    if (scrollCenter >= toSegment.end) {
      return {
        inZone: true,
        progress: 1,
        activeIndex: toSegment.index,
      };
    }
    return {
      inZone: true,
      progress,
      activeIndex: progress >= 0.5 ? toSegment.index : fromSegment.index,
    };
  }

  return null;
}

function buildDrivePayload(
  fromSegment: IListStorySegmentRange,
  toSegment: IListStorySegmentRange,
  progress: number,
): IListStoryScrollDrivePayload {
  return {
    progress,
    fromIndex: fromSegment.index,
    toIndex: toSegment.index,
    fromMode: fromSegment.contentMode,
    toMode: toSegment.contentMode,
  };
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

  for (let i = 0; i < segments.length - 1; i++) {
    const fromSegment = segments[i];
    const toSegment = segments[i + 1];

    if (!pairNeedsScrollDrive(fromSegment.contentMode, toSegment.contentMode)) {
      continue;
    }

    const pairDrive = computePairDrive(scrollCenter, fromSegment, toSegment);
    if (!pairDrive) {
      continue;
    }

    return {
      activeIndex: pairDrive.activeIndex,
      drive: buildDrivePayload(fromSegment, toSegment, pairDrive.progress),
    };
  }

  const at = findSegmentAt(scrollCenter, segments);
  return {
    activeIndex: at.index,
    drive: null,
  };
}
