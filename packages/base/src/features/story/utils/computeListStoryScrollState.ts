import type { IListStoryScrollDrivePayload } from '@/src/features/story/types/listStoryScrollDrive';

import type { IListStorySegmentRange } from './listStoryLayout';
import { pairNeedsScrollDrive } from './segmentDisplayMode';

export interface IListStoryScrollState {
  activeIndex: number;
  drive: IListStoryScrollDrivePayload | null;
}

export interface IComputeListStoryScrollInput {
  scrollTop: number;
  viewportHeight: number;
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

/** Progress 0..1 across layout gap until the next segment start meets viewport top. */
function progressHandoff(
  scrollTop: number,
  fromSegment: IListStorySegmentRange,
  toSegment: IListStorySegmentRange,
): number | null {
  const handoff = toSegment.start - fromSegment.start;
  if (handoff <= 0) {
    return null;
  }
  return clamp01((scrollTop - fromSegment.start) / handoff);
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

function computePairDrive(
  scrollTop: number,
  fromSegment: IListStorySegmentRange,
  toSegment: IListStorySegmentRange,
): IPairDriveResult | null {
  const fromMode = fromSegment.contentMode;
  const toMode = toSegment.contentMode;

  if (fromMode === 'map' && toMode === 'markdown') {
    if (scrollTop < fromSegment.start) {
      return null;
    }
    if (scrollTop >= toSegment.start) {
      return null;
    }
    const progress = progressHandoff(scrollTop, fromSegment, toSegment);
    if (progress === null) {
      return null;
    }
    return {
      inZone: true,
      progress,
      activeIndex: progress >= 0.5 ? toSegment.index : fromSegment.index,
    };
  }

  if (fromMode === 'markdown' && toMode === 'map') {
    if (scrollTop < fromSegment.start) {
      return null;
    }
    if (scrollTop >= toSegment.start) {
      return null;
    }
    const progress = progressHandoff(scrollTop, fromSegment, toSegment);
    if (progress === null) {
      return null;
    }
    return {
      inZone: true,
      progress,
      activeIndex: progress >= 0.5 ? toSegment.index : fromSegment.index,
    };
  }

  if (fromMode === 'markdown' && toMode === 'markdown') {
    if (scrollTop < fromSegment.start) {
      return null;
    }
    if (scrollTop >= toSegment.end) {
      return {
        inZone: true,
        progress: 1,
        activeIndex: toSegment.index,
      };
    }
    const progress = progressHandoff(scrollTop, fromSegment, toSegment);
    if (progress === null) {
      return null;
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
  scrollTop,
  viewportHeight,
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

    const pairDrive = computePairDrive(scrollTop, fromSegment, toSegment);
    if (!pairDrive) {
      continue;
    }

    return {
      activeIndex: pairDrive.activeIndex,
      drive: buildDrivePayload(fromSegment, toSegment, pairDrive.progress),
    };
  }

  const scrollCenter = scrollTop + viewportHeight / 2;
  const at = findSegmentAt(scrollCenter, segments);
  return {
    activeIndex: at.index,
    drive: null,
  };
}
