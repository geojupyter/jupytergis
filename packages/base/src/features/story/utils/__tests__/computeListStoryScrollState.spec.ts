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
  const mapThenMarkdown = [seg(0, 0, 200, 'map'), seg(1, 200, 400, 'markdown')];
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

  it('keeps map-only scroll free of overlay drive before markdown segment', () => {
    expect(
      computeListStoryScrollState({
        scrollCenter: 160,
        segments: mapThenMarkdown,
        prev: null,
      }),
    ).toEqual({ activeIndex: 0, drive: null });
  });

  it('ramps overlay progress across the markdown segment for map to markdown', () => {
    expect(
      computeListStoryScrollState({
        scrollCenter: 220,
        segments: mapThenMarkdown,
        prev: null,
      }),
    ).toEqual({
      activeIndex: 0,
      drive: {
        progress: 0.1,
        fromIndex: 0,
        toIndex: 1,
        fromMode: 'map',
        toMode: 'markdown',
      },
    });

    expect(
      computeListStoryScrollState({
        scrollCenter: 300,
        segments: mapThenMarkdown,
        prev: null,
      }),
    ).toEqual({
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

  it('has no drive before the first segment', () => {
    expect(
      computeListStoryScrollState({
        scrollCenter: -50,
        segments: mapThenMarkdown,
        prev: null,
      }),
    ).toEqual({ activeIndex: 0, drive: null });
  });

  it('clamps markdown-to-markdown progress at scroll bottom', () => {
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

  it('falls through when a transition segment has zero height', () => {
    expect(
      computeListStoryScrollState({
        scrollCenter: 200,
        segments: [seg(0, 0, 200), seg(1, 200, 200), seg(2, 200, 200)],
        prev: null,
      }),
    ).toEqual({ activeIndex: 2, drive: null });
  });
});
