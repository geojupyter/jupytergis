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

  it('places segments back-to-back from scroll offset zero', () => {
    const layout = buildListStoryLayout({
      items: [
        item('a', 0, 'map'),
        item('b', 1, 'markdown', 'line\nline'),
      ],
      viewportHeight: 400,
      heightsById: { a: 300, b: 500 },
    });

    expect(layout).not.toBeNull();
    expect(layout!.trackHeight).toBe(800);
    expect(layout!.segments[0]).toMatchObject({
      start: 0,
      end: 300,
      height: 300,
      measured: true,
    });
    expect(layout!.segments[1]).toMatchObject({
      start: 300,
      end: 800,
      height: 500,
      measured: true,
    });
  });

  it('starts short markdown-first stories at offset zero', () => {
    const layout = buildListStoryLayout({
      items: [
        item('md', 0, 'markdown', 'short'),
        item('map', 1, 'map'),
      ],
      viewportHeight: 400,
      heightsById: { md: 120 },
    });

    expect(layout!.segments[0]).toMatchObject({
      start: 0,
      end: 120,
      height: 120,
      contentMode: 'markdown',
    });
  });
});
