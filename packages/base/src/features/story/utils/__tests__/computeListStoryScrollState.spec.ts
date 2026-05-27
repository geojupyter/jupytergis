import { computeListStoryScrollState } from '../computeListStoryScrollState';
import type { IListStorySegmentRange } from '../../types/storyDerived';

const VIEWPORT = 100;

function seg(
  index: number,
  start: number,
  end: number,
  contentMode: 'map' | 'markdown' = 'map',
  id = `seg-${index}`,
): IListStorySegmentRange {
  return {
    id,
    index,
    start,
    end,
    height: end - start,
    measured: true,
    contentMode,
  };
}

function compute(
  scrollTop: number,
  segments: IListStorySegmentRange[],
  viewportHeight = VIEWPORT,
) {
  return computeListStoryScrollState({
    scrollTop,
    viewportHeight,
    segments,
    prev: null,
  });
}

describe('computeListStoryScrollState', () => {
  const mapThenMarkdown = [seg(0, 0, 200, 'map'), seg(1, 200, 400, 'markdown')];
  const threeSegments = [
    seg(0, 0, 200, 'map'),
    seg(1, 200, 400, 'markdown'),
    seg(2, 400, 600, 'markdown'),
  ];

  it('returns first segment when only one segment', () => {
    expect(compute(50, [seg(0, 0, 200)])).toEqual({
      activeIndex: 0,
      drive: null,
    });
  });

  it('ramps map-to-markdown over map segment height, not story scroller height', () => {
    const mapStageThenMd = [
      seg(0, 0, 1039, 'map'),
      seg(1, 1039, 2078, 'markdown'),
    ];

    expect(compute(600, mapStageThenMd, 439)).toEqual({
      activeIndex: 1,
      drive: {
        progress: 600 / 1039,
        fromIndex: 0,
        toIndex: 1,
        fromMode: 'map',
        toMode: 'markdown',
      },
    });
  });

  it('ramps map-to-markdown across the map segment layout span', () => {
    expect(compute(0, mapThenMarkdown)).toEqual({
      activeIndex: 0,
      drive: {
        progress: 0,
        fromIndex: 0,
        toIndex: 1,
        fromMode: 'map',
        toMode: 'markdown',
      },
    });

    expect(compute(40, mapThenMarkdown)).toEqual({
      activeIndex: 0,
      drive: {
        progress: 0.2,
        fromIndex: 0,
        toIndex: 1,
        fromMode: 'map',
        toMode: 'markdown',
      },
    });

    expect(compute(100, mapThenMarkdown)).toEqual({
      activeIndex: 1,
      drive: {
        progress: 0.5,
        fromIndex: 0,
        toIndex: 1,
        fromMode: 'map',
        toMode: 'markdown',
      },
    });
  });

  it('starts markdown-to-map at progress 0 when segment top is at viewport top', () => {
    const mdThenMap = [seg(0, 0, 985, 'markdown'), seg(1, 985, 1924, 'map')];

    expect(compute(0, mdThenMap, 939)).toEqual({
      activeIndex: 0,
      drive: {
        progress: 0,
        fromIndex: 0,
        toIndex: 1,
        fromMode: 'markdown',
        toMode: 'map',
      },
    });

    expect(compute(492.5, mdThenMap, 939)).toEqual({
      activeIndex: 1,
      drive: {
        progress: 0.5,
        fromIndex: 0,
        toIndex: 1,
        fromMode: 'markdown',
        toMode: 'map',
      },
    });
  });

  it('drives map-to-map across the segment handoff', () => {
    const mapSegments = [
      seg(0, 0, 200, 'map'),
      seg(1, 200, 400, 'map'),
      seg(2, 400, 600, 'map'),
    ];

    expect(compute(270, mapSegments)).toEqual({
      activeIndex: 1,
      drive: {
        progress: 0.35,
        fromIndex: 1,
        toIndex: 2,
        fromMode: 'map',
        toMode: 'map',
      },
    });
  });

  it('has no drive before the first segment', () => {
    expect(compute(-50, mapThenMarkdown)).toEqual({
      activeIndex: 0,
      drive: null,
    });
  });

  it('clamps markdown-to-markdown progress at scroll bottom', () => {
    expect(compute(500, threeSegments)).toEqual({
      activeIndex: 2,
      drive: {
        progress: 1,
        fromIndex: 1,
        toIndex: 2,
        fromMode: 'markdown',
        toMode: 'markdown',
      },
    });
  });

  it('falls through when a transition segment has zero height', () => {
    expect(
      compute(200, [seg(0, 0, 200), seg(1, 200, 200), seg(2, 200, 200)]),
    ).toEqual({ activeIndex: 2, drive: null });
  });
});
