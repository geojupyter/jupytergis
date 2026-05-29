import { computeListStoryOverlayHeight } from '../utils/computeListStoryOverlayHeight';
import { buildListStoryLayout } from '../utils/listStoryLayout';
import { storyItem } from './fixtures/listStoryTestItems';

describe('computeListStoryOverlayHeight', () => {
  const layout = buildListStoryLayout({
    items: [storyItem('md', 0, 'markdown', 'lines'), storyItem('map', 1, 'map')],
    viewportHeight: 400,
    mapViewportHeight: 350,
    heightsById: { md: 800 },
  });

  it('returns stage height during scroll-drive', () => {
    expect(
      computeListStoryOverlayHeight({
        stageHeight: 600,
        layout,
        fromPane: { type: 'markdown', segmentIndex: 0 },
        toPane: { type: 'map', segmentIndex: 1 },
        mode: 'scroll-drive',
        activeSegmentIndex: 0,
      }),
    ).toBe(600);
  });

  it('returns stage height for map panes at rest', () => {
    expect(
      computeListStoryOverlayHeight({
        stageHeight: 600,
        layout,
        fromPane: { type: 'map', segmentIndex: 1 },
        toPane: { type: 'map', segmentIndex: 1 },
        mode: 'at-rest',
        activeSegmentIndex: 1,
      }),
    ).toBe(600);
  });

  it('uses layout markdown height at rest when taller than stage', () => {
    expect(
      computeListStoryOverlayHeight({
        stageHeight: 600,
        layout,
        fromPane: { type: 'markdown', segmentIndex: 0 },
        toPane: { type: 'markdown', segmentIndex: 0 },
        mode: 'at-rest',
        activeSegmentIndex: 0,
      }),
    ).toBe(800);
  });

  it('falls back to stage height when layout is missing', () => {
    expect(
      computeListStoryOverlayHeight({
        stageHeight: 600,
        layout: null,
        fromPane: { type: 'markdown', segmentIndex: 0 },
        toPane: { type: 'markdown', segmentIndex: 0 },
        mode: 'at-rest',
        activeSegmentIndex: 0,
      }),
    ).toBe(600);
  });
});
