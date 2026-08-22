import {
  buildListStoryScrollTrack,
  estimateMarkdownHeight,
  getSegmentDisplayMode,
  getTransitionTranslatePx,
} from '../utils/listStoryScrollTrack';
import { storyItem } from './fixtures/listStoryTestItems';

describe('getSegmentDisplayMode', () => {
  it('returns markdown when contentMode is markdown', () => {
    expect(
      getSegmentDisplayMode({
        content: { contentMode: 'markdown', markdown: 'x' },
      }),
    ).toBe('markdown');
  });

  it('returns map otherwise', () => {
    expect(getSegmentDisplayMode(undefined)).toBe('map');
    expect(getSegmentDisplayMode({ content: { contentMode: 'map' } })).toBe(
      'map',
    );
  });
});

describe('estimateMarkdownHeight', () => {
  it('uses line count and enforces a viewport minimum', () => {
    expect(estimateMarkdownHeight('a\nb', 400)).toBe(
      Math.max(2 * 28 + 32, 200),
    );
    expect(estimateMarkdownHeight('', 100)).toBe(60);
  });
});

describe('buildListStoryScrollTrack', () => {
  it('returns null for empty items or zero viewport', () => {
    expect(
      buildListStoryScrollTrack({ items: [], viewportHeight: 600 }),
    ).toBeNull();
    expect(
      buildListStoryScrollTrack({
        items: [storyItem('a', 0, 'map')],
        viewportHeight: 0,
      }),
    ).toBeNull();
  });

  it('chains segments with a handoff gap after each except the last', () => {
    const layout = buildListStoryScrollTrack({
      items: [
        storyItem('a', 0, 'map'),
        storyItem('b', 1, 'markdown', 'line\nline'),
        storyItem('c', 2, 'map'),
      ],
      viewportHeight: 400,
      mapViewportHeight: 350,
      heightsById: { b: 500 },
    });

    expect(layout).not.toBeNull();
    const { segments } = layout;
    const gap = 350;

    expect(segments[0]).toMatchObject({
      start: 0,
      height: 350,
      end: 0 + 350 + gap,
      measured: true,
      contentMode: 'map',
    });
    expect(segments[1]).toMatchObject({
      start: 700,
      height: 500,
      end: 700 + 500 + gap,
      measured: true,
      contentMode: 'markdown',
    });
    expect(segments[2]).toMatchObject({
      start: 1550,
      height: 350,
      end: 1550 + 350,
      contentMode: 'map',
    });

    expect(segments[1].start).toBe(segments[0].end);
    expect(segments[2].start).toBe(segments[1].end);
    expect(layout.scrollTrackHeight).toBe(segments[2].end);
  });

  it('uses map viewport height for map segments, not heightsById', () => {
    const layout = buildListStoryScrollTrack({
      items: [storyItem('map', 0, 'map')],
      viewportHeight: 400,
      mapViewportHeight: 350,
      heightsById: { map: 999 },
    });

    expect(layout.segments[0].height).toBe(350);
  });

  it('estimates unmeasured markdown with measured false', () => {
    const layout = buildListStoryScrollTrack({
      items: [storyItem('md', 0, 'markdown', 'short')],
      viewportHeight: 400,
    });

    expect(layout.segments[0]).toMatchObject({
      start: 0,
      measured: false,
      contentMode: 'markdown',
    });
    expect(layout.segments[0].height).toBeGreaterThanOrEqual(200);
  });

  it('starts markdown-first stories at offset zero', () => {
    const layout = buildListStoryScrollTrack({
      items: [
        storyItem('md', 0, 'markdown', 'short'),
        storyItem('map', 1, 'map'),
      ],
      viewportHeight: 400,
      mapViewportHeight: 350,
      heightsById: { md: 120 },
    });

    expect(layout.segments[0]).toMatchObject({
      start: 0,
      end: 120 + 350,
      height: 120,
      contentMode: 'markdown',
    });
  });

  it('omits gap between markdown segments when markdownSegmentGap is false', () => {
    const layout = buildListStoryScrollTrack({
      items: [
        storyItem('a', 0, 'markdown', 'one'),
        storyItem('b', 1, 'markdown', 'two'),
      ],
      viewportHeight: 400,
      heightsById: { a: 120, b: 180 },
      markdownSegmentGap: false,
    });

    expect(layout.segments[0]).toMatchObject({
      start: 0,
      height: 120,
      end: 120,
    });
    expect(layout.segments[1]).toMatchObject({
      start: 120,
      height: 180,
      end: 300,
    });
  });

  it('inserts gap between markdown segments when markdownSegmentGap is true', () => {
    const layout = buildListStoryScrollTrack({
      items: [
        storyItem('a', 0, 'markdown', 'one'),
        storyItem('b', 1, 'markdown', 'two'),
      ],
      viewportHeight: 400,
      mapViewportHeight: 350,
      heightsById: { a: 120, b: 180 },
      markdownSegmentGap: true,
    });

    expect(layout.segments[0]).toMatchObject({
      start: 0,
      height: 120,
      end: 120 + 350,
    });
    expect(layout.segments[1]).toMatchObject({
      start: 470,
      height: 180,
      end: 650,
    });
  });
});

describe('getTransitionTranslatePx', () => {
  const mapMdLayout = buildListStoryScrollTrack({
    items: [
      storyItem('a', 0, 'map'),
      storyItem('b', 1, 'markdown', 'line\nline'),
      storyItem('c', 2, 'map'),
    ],
    viewportHeight: 400,
    mapViewportHeight: 350,
    heightsById: { b: 500 },
  });

  it('returns 0 without transition or layout', () => {
    expect(getTransitionTranslatePx(null, mapMdLayout)).toBe(0);
    expect(
      getTransitionTranslatePx(
        {
          progress: 0,
          fromIndex: 0,
          toIndex: 1,
          fromMode: 'map',
          toMode: 'markdown',
        },
        null,
      ),
    ).toBe(0);
  });

  it('uses segment height for intra-segment scroll', () => {
    expect(
      getTransitionTranslatePx(
        {
          progress: 0.4,
          fromIndex: 1,
          toIndex: 1,
          fromMode: 'markdown',
          toMode: 'markdown',
        },
        mapMdLayout,
      ),
    ).toBe(500);
  });

  it('uses to.start - from.start for map↔markdown handoffs', () => {
    const { segments } = mapMdLayout;
    expect(
      getTransitionTranslatePx(
        {
          progress: 0.5,
          fromIndex: 0,
          toIndex: 1,
          fromMode: 'map',
          toMode: 'markdown',
        },
        mapMdLayout,
      ),
    ).toBe(segments[1].start - segments[0].start);

    expect(
      getTransitionTranslatePx(
        {
          progress: 0.5,
          fromIndex: 1,
          toIndex: 2,
          fromMode: 'markdown',
          toMode: 'map',
        },
        mapMdLayout,
      ),
    ).toBe(segments[2].start - segments[1].start);
  });

  it('uses from height only for md→md with no gap', () => {
    const layout = buildListStoryScrollTrack({
      items: [
        storyItem('a', 0, 'markdown', 'one'),
        storyItem('b', 1, 'markdown', 'two'),
      ],
      viewportHeight: 400,
      heightsById: { a: 120, b: 180 },
      markdownSegmentGap: false,
    });

    expect(
      getTransitionTranslatePx(
        {
          progress: 0.5,
          fromIndex: 0,
          toIndex: 1,
          fromMode: 'markdown',
          toMode: 'markdown',
        },
        layout,
      ),
    ).toBe(120);
  });

  it('includes gap for md→md when markdownSegmentGap is true', () => {
    const layout = buildListStoryScrollTrack({
      items: [
        storyItem('a', 0, 'markdown', 'one'),
        storyItem('b', 1, 'markdown', 'two'),
      ],
      viewportHeight: 400,
      mapViewportHeight: 350,
      heightsById: { a: 120, b: 180 },
      markdownSegmentGap: true,
    });

    expect(
      getTransitionTranslatePx(
        {
          progress: 0.5,
          fromIndex: 0,
          toIndex: 1,
          fromMode: 'markdown',
          toMode: 'markdown',
        },
        layout,
      ),
    ).toBe(120 + 350);
  });
});
