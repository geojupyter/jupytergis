import type {
  IListStorySegmentTransition,
  IListStoryScrollTrackSegment,
} from '@/src/features/story/types/types';

export interface IListStoryScrollState {
  activeIndex: number;
  segmentTransition: IListStorySegmentTransition | null;
}

interface IComputeListStoryScrollInput {
  scrollTop: number;
  viewportHeight: number;
  segments: IListStoryScrollTrackSegment[];
}

interface IPairTransitionResult {
  progress: number;
  activeIndex: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function findSegmentAtScrollCenter(
  scrollCenter: number,
  segments: IListStoryScrollTrackSegment[],
): IListStoryScrollTrackSegment {
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

function computePairTransition(
  scrollTop: number,
  fromSegment: IListStoryScrollTrackSegment,
  toSegment: IListStoryScrollTrackSegment,
): IPairTransitionResult | null {
  if (scrollTop < fromSegment.start || scrollTop >= toSegment.end) {
    return null;
  }

  const handoffEndScrollTop = toSegment.start;
  const handoffSpan = handoffEndScrollTop - fromSegment.start;
  if (handoffSpan <= 0) {
    return null;
  }

  if (scrollTop >= handoffEndScrollTop) {
    return null;
  }

  const progress = clamp01((scrollTop - fromSegment.start) / handoffSpan);

  return {
    progress,
    activeIndex: progress >= 0.5 ? toSegment.index : fromSegment.index,
  };
}

function buildSegmentTransitionPayload(
  fromSegment: IListStoryScrollTrackSegment,
  toSegment: IListStoryScrollTrackSegment,
  progress: number,
): IListStorySegmentTransition {
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
      segmentTransition: null,
    };
  }

  for (let i = 0; i < segments.length - 1; i++) {
    const fromSegment = segments[i];
    const toSegment = segments[i + 1];

    const pairTransition = computePairTransition(
      scrollTop,
      fromSegment,
      toSegment,
    );
    if (!pairTransition) {
      continue;
    }

    return {
      activeIndex: pairTransition.activeIndex,
      segmentTransition: buildSegmentTransitionPayload(
        fromSegment,
        toSegment,
        pairTransition.progress,
      ),
    };
  }

  const scrollCenter = scrollTop + viewportHeight / 2;
  const activeSegment = findSegmentAtScrollCenter(scrollCenter, segments);

  return {
    activeIndex: activeSegment.index,
    segmentTransition: null,
  };
}
