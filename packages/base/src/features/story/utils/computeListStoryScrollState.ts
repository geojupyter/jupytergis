import type {
  IListStoryScrollDrivePayload,
  IListStorySegmentRange,
} from '@/src/features/story/types/types';

export interface IListStoryScrollState {
  activeIndex: number;
  drive: IListStoryScrollDrivePayload | null;
}

interface IComputeListStoryScrollInput {
  scrollTop: number;
  viewportHeight: number;
  segments: IListStorySegmentRange[];
}

interface IPairDriveResult {
  progress: number;
  activeIndex: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
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
  if (scrollTop < fromSegment.start || scrollTop >= toSegment.end) {
    return null;
  }

  const transitionEnd = toSegment.start;
  const handoffSpan = transitionEnd - fromSegment.start;
  if (handoffSpan <= 0) {
    return null;
  }

  if (scrollTop >= transitionEnd) {
    return null;
  }

  const progress = clamp01((scrollTop - fromSegment.start) / handoffSpan);

  return {
    progress,
    activeIndex: progress >= 0.5 ? toSegment.index : fromSegment.index,
  };
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

export function computeListStoryScrollState({
  scrollTop,
  viewportHeight,
  segments,
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
  const activeSegment = findSegmentAt(scrollCenter, segments);

  return {
    activeIndex: activeSegment.index,
    drive: null,
  };
}
