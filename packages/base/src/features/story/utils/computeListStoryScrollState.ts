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

/** Same-segment scroll (from and to pane share content; to pane is the stack tail). */
export function isIntraSegmentScroll(
  transition: IListStorySegmentTransition | null,
): boolean {
  return transition !== null && transition.fromIndex === transition.toIndex;
}

function findSegmentAtScrollTop(
  scrollTop: number,
  segments: IListStoryScrollTrackSegment[],
): IListStoryScrollTrackSegment {
  if (scrollTop < segments[0].start) {
    return segments[0];
  }

  for (const segment of segments) {
    if (scrollTop >= segment.start && scrollTop < segment.end) {
      return segment;
    }
  }

  return segments[segments.length - 1];
}

function buildIntraSegmentScrollState(
  segment: IListStoryScrollTrackSegment,
  scrollTop: number,
): IListStoryScrollState {
  const span = segment.end - segment.start;
  const progress = span > 0 ? clamp01((scrollTop - segment.start) / span) : 0;

  return {
    activeIndex: segment.index,
    segmentTransition: {
      progress,
      fromIndex: segment.index,
      toIndex: segment.index,
      fromMode: segment.contentMode,
      toMode: segment.contentMode,
    },
  };
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

  if (segments.length > 1) {
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
  }

  return buildIntraSegmentScrollState(
    findSegmentAtScrollTop(scrollTop, segments),
    scrollTop,
  );
}
