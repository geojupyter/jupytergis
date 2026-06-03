import { IListStoryScrollTrackSegment } from '../types/types';
import { computeListStoryScrollState } from '../utils/computeListStoryScrollState';
import { layoutSegments, storyItem } from './fixtures/listStoryTestItems';

const VIEWPORT = 100;

function compute(
  scrollTop: number,
  segments: IListStoryScrollTrackSegment[],
  viewportHeight = VIEWPORT,
) {
  return computeListStoryScrollState({
    scrollTop,
    viewportHeight,
    segments,
  });
}

function handoffSpan(
  segments: IListStoryScrollTrackSegment[],
  pairIndex: number,
): number {
  const from = segments[pairIndex];
  const to = segments[pairIndex + 1];
  return to.start - from.start;
}

describe('computeListStoryScrollState', () => {
  const twoSegmentItems = [
    storyItem('map', 0, 'map'),
    storyItem('md', 1, 'markdown', 'line\nline'),
  ];

  const threeSegmentItems = [
    storyItem('a', 0, 'map'),
    storyItem('b', 1, 'markdown', 'x'),
    storyItem('c', 2, 'map'),
  ];

  it('returns first segment when only one segment', () => {
    const segments = layoutSegments({
      items: [storyItem('only', 0, 'map')],
      viewportHeight: 400,
      mapViewportHeight: 350,
    });

    expect(compute(50, segments)).toEqual({
      activeIndex: 0,
      segmentTransition: null,
    });
  });

  it('ramps progress over layout handoff span including stage gap', () => {
    const segments = layoutSegments({
      items: twoSegmentItems,
      viewportHeight: 400,
      mapViewportHeight: 350,
      heightsById: { md: 500 },
    });

    const span = handoffSpan(segments, 0);
    expect(span).toBe(350 + 350);

    expect(compute(0, segments)).toEqual({
      activeIndex: 0,
      segmentTransition: {
        progress: 0,
        fromIndex: 0,
        toIndex: 1,
        fromMode: 'map',
        toMode: 'markdown',
      },
    });

    const midGapScroll = 500;
    expect(
      compute(midGapScroll, segments)?.segmentTransition?.progress,
    ).toBeCloseTo(midGapScroll / span, 5);

    expect(
      compute(span - 1, segments)?.segmentTransition?.progress,
    ).toBeCloseTo((span - 1) / span, 5);
  });

  it('starts the next pair handoff when the prior segment start is reached', () => {
    const segments = layoutSegments({
      items: threeSegmentItems,
      viewportHeight: 400,
      mapViewportHeight: 350,
      heightsById: { b: 400 },
    });

    const seg1Start = segments[1].start;
    expect(compute(seg1Start, segments)?.segmentTransition).toEqual({
      progress: 0,
      fromIndex: 1,
      toIndex: 2,
      fromMode: 'markdown',
      toMode: 'map',
    });
  });

  it('has no segmentTransition in the last segment body after its handoff completes', () => {
    const segments = layoutSegments({
      items: threeSegmentItems,
      viewportHeight: 400,
      mapViewportHeight: 350,
      heightsById: { b: 400 },
    });

    const bodyScroll = segments[2].start + 100;
    expect(compute(bodyScroll, segments)).toEqual({
      activeIndex: 2,
      segmentTransition: null,
    });
  });

  it('activates the next pair during later handoffs', () => {
    const segments = layoutSegments({
      items: threeSegmentItems,
      viewportHeight: 400,
      mapViewportHeight: 350,
      heightsById: { b: 400 },
    });

    const pair1Span = handoffSpan(segments, 1);
    const scrollInSecondHandoff =
      segments[1].start + Math.floor(pair1Span * 0.35);

    const state = compute(scrollInSecondHandoff, segments);
    expect(state?.activeIndex).toBe(1);
    expect(state?.segmentTransition).toMatchObject({
      fromIndex: 1,
      toIndex: 2,
      fromMode: 'markdown',
      toMode: 'map',
    });
    expect(state?.segmentTransition?.progress).toBeCloseTo(0.35, 2);
  });

  it('flips activeIndex at progress 0.5 during handoff', () => {
    const segments = layoutSegments({
      items: twoSegmentItems,
      viewportHeight: 400,
      mapViewportHeight: 350,
      heightsById: { md: 500 },
    });

    const span = handoffSpan(segments, 0);
    const beforeHalf = Math.floor(span * 0.49);
    const afterHalf = Math.floor(span * 0.51);

    expect(compute(beforeHalf, segments)?.activeIndex).toBe(0);
    expect(compute(afterHalf, segments)?.activeIndex).toBe(1);
  });

  it('ramps map-to-markdown over full map layout span, not scroller viewport', () => {
    const segments = layoutSegments({
      items: [storyItem('map', 0, 'map'), storyItem('md', 1, 'markdown', 'x')],
      viewportHeight: 439,
      mapViewportHeight: 1039,
      heightsById: { md: 1039 },
    });

    const span = handoffSpan(segments, 0);
    expect(span).toBe(1039 + 1039);

    expect(compute(600, segments, 439)).toEqual({
      activeIndex: 0,
      segmentTransition: {
        progress: 600 / span,
        fromIndex: 0,
        toIndex: 1,
        fromMode: 'map',
        toMode: 'markdown',
      },
    });
  });

  it('has no segmentTransition before the first segment', () => {
    const segments = layoutSegments({
      items: twoSegmentItems,
      viewportHeight: 400,
      mapViewportHeight: 350,
      heightsById: { md: 500 },
    });

    expect(compute(-50, segments)).toEqual({
      activeIndex: 0,
      segmentTransition: null,
    });
  });

  it('falls through when a transition segment has zero height', () => {
    expect(
      compute(200, [
        {
          id: '0',
          index: 0,
          start: 0,
          end: 200,
          height: 200,
          measured: true,
          contentMode: 'map',
        },
        {
          id: '1',
          index: 1,
          start: 200,
          end: 200,
          height: 0,
          measured: true,
          contentMode: 'map',
        },
        {
          id: '2',
          index: 2,
          start: 200,
          end: 400,
          height: 200,
          measured: true,
          contentMode: 'map',
        },
      ]),
    ).toEqual({ activeIndex: 2, segmentTransition: null });
  });

  it('clamps progress to [0, 1]', () => {
    const segments = layoutSegments({
      items: twoSegmentItems,
      viewportHeight: 400,
      mapViewportHeight: 350,
      heightsById: { md: 500 },
    });

    const segmentTransition = compute(0, segments)?.segmentTransition;
    expect(segmentTransition?.progress).toBeGreaterThanOrEqual(0);
    expect(segmentTransition?.progress).toBeLessThanOrEqual(1);
  });
});
