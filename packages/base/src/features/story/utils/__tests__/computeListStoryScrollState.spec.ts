import {
  computeListStoryScrollState,
  type IListStoryScrollState,
} from '@/src/features/story/utils/computeListStoryScrollState';
import type { IListStorySegmentRange } from '@/src/features/story/utils/listStoryLayout';

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

describe('computeListStoryScrollState', () => {
  const threeSegments = [
    seg(0, 0, 200, 'map'),
    seg(1, 200, 400, 'markdown'),
    seg(2, 400, 600, 'markdown'),
  ];

  it('returns first segment when only one segment', () => {
    expect(
      computeListStoryScrollState({
        scrollCenter: 50,
        segments: [seg(0, 0, 200)],
        prev: null,
      }),
    ).toEqual({ activeIndex: 0, drive: null });
  });

  it('derives progress across adjacent segment spans', () => {
    expect(
      computeListStoryScrollState({
        scrollCenter: 160,
        segments: threeSegments,
        prev: null,
      }),
    ).toEqual({
      activeIndex: 0,
      drive: {
        progress: 0.4,
        fromIndex: 0,
        toIndex: 1,
        fromMode: 'map',
        toMode: 'markdown',
      },
    });

    expect(
      computeListStoryScrollState({
        scrollCenter: 240,
        segments: threeSegments,
        prev: null,
      }),
    ).toEqual({
      activeIndex: 1,
      drive: {
        progress: 0.6,
        fromIndex: 0,
        toIndex: 1,
        fromMode: 'map',
        toMode: 'markdown',
      },
    });
  });

  it('clears drive for map-to-map pairs but still updates active index', () => {
    const mapSegments = [
      seg(0, 0, 200, 'map'),
      seg(1, 200, 400, 'map'),
      seg(2, 400, 600, 'map'),
    ];

    expect(
      computeListStoryScrollState({
        scrollCenter: 320,
        segments: mapSegments,
        prev: null,
      }),
    ).toEqual({ activeIndex: 1, drive: null });
  });

  it('clamps to first pair at scroll top', () => {
    expect(
      computeListStoryScrollState({
        scrollCenter: -50,
        segments: threeSegments,
        prev: null,
      }),
    ).toEqual({
      activeIndex: 0,
      drive: {
        progress: 0,
        fromIndex: 0,
        toIndex: 1,
        fromMode: 'map',
        toMode: 'markdown',
      },
    });
  });

  it('clamps to last pair at scroll bottom', () => {
    expect(
      computeListStoryScrollState({
        scrollCenter: 900,
        segments: threeSegments,
        prev: null,
      }),
    ).toEqual({
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

  it('returns prev when adjacent segment spans collapse to zero', () => {
    const prev: IListStoryScrollState = {
      activeIndex: 1,
      drive: {
        progress: 0.5,
        fromIndex: 0,
        toIndex: 1,
        fromMode: 'map',
        toMode: 'markdown',
      },
    };

    expect(
      computeListStoryScrollState({
        scrollCenter: 200,
        segments: [seg(0, 0, 200), seg(1, 200, 200), seg(2, 200, 200)],
        prev,
      }),
    ).toBe(prev);
  });
});
