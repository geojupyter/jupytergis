import {
  computeListStoryScrollState,
  type IListStorySegmentCardLayout,
  type IListStoryScrollState,
} from '@/src/features/story/utils/computeListStoryScrollState';

function card(
  index: number,
  center: number,
  contentMode: 'map' | 'markdown' = 'map',
): IListStorySegmentCardLayout {
  return { index, center, contentMode };
}

describe('computeListStoryScrollState', () => {
  const threeCards = [
    card(0, 100, 'map'),
    card(1, 300, 'markdown'),
    card(2, 500, 'markdown'),
  ];

  it('returns first segment when only one card', () => {
    expect(
      computeListStoryScrollState({
        scrollCenter: 50,
        cards: [card(0, 100)],
        prev: null,
      }),
    ).toEqual({ activeIndex: 0, drive: null });
  });

  it('picks active index from pair progress threshold', () => {
    expect(
      computeListStoryScrollState({
        scrollCenter: 180,
        cards: threeCards,
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
        scrollCenter: 220,
        cards: threeCards,
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
    const mapCards = [card(0, 100), card(1, 300), card(2, 500)];

    expect(
      computeListStoryScrollState({
        scrollCenter: 220,
        cards: mapCards,
        prev: null,
      }),
    ).toEqual({ activeIndex: 1, drive: null });
  });

  it('clamps to first pair at scroll top', () => {
    expect(
      computeListStoryScrollState({
        scrollCenter: 0,
        cards: threeCards,
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
        cards: threeCards,
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

  it('returns prev when adjacent card centers collapse to zero span', () => {
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
        cards: [card(0, 200), card(1, 200), card(2, 500)],
        prev,
      }),
    ).toBe(prev);
  });
});
