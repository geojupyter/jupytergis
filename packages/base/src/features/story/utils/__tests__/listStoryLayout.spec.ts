import { buildListStoryLayout } from '@/src/features/story/utils/listStoryLayout';

function item(
  id: string,
  index: number,
  contentMode: 'map' | 'markdown',
  markdown = '',
) {
  return {
    id,
    index,
    layerName: id,
    activeSlide: {
      content: {
        contentMode,
        markdown,
      },
    },
  };
}

describe('buildListStoryLayout', () => {
  it('returns null for empty items or zero viewport', () => {
    expect(
      buildListStoryLayout({ items: [], viewportHeight: 600 }),
    ).toBeNull();
    expect(
      buildListStoryLayout({
        items: [item('a', 0, 'map')],
        viewportHeight: 0,
      }),
    ).toBeNull();
  });

  it('places segments back-to-back with edge padding', () => {
    const layout = buildListStoryLayout({
      items: [
        item('a', 0, 'map'),
        item('b', 1, 'markdown', 'line\nline'),
      ],
      viewportHeight: 400,
      heightsById: { a: 300, b: 500 },
    });

    expect(layout).not.toBeNull();
    expect(layout!.padTop).toBe(50);
    expect(layout!.padBottom).toBe(0);
    expect(layout!.trackHeight).toBe(800);
    expect(layout!.totalScrollHeight).toBe(850);
    expect(layout!.segments[0]).toMatchObject({
      start: 50,
      end: 350,
      height: 300,
      measured: true,
    });
    expect(layout!.segments[1]).toMatchObject({
      start: 350,
      end: 850,
      height: 500,
      measured: true,
    });
  });
});
