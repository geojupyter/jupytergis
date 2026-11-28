import {
  estimateMarkdownHeight,
  getSegmentDisplayMode,
} from '../utils/listStoryScrollTrack';

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
