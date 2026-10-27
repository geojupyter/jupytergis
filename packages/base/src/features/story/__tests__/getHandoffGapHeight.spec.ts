import { getHandoffGapHeight } from '../utils/getHandoffGapHeight';

const MAP_HEIGHT = 350;

describe('getHandoffGapHeight', () => {
  it('returns map height when either segment is a map', () => {
    expect(getHandoffGapHeight('map', 'map', MAP_HEIGHT, false)).toBe(
      MAP_HEIGHT,
    );
    expect(getHandoffGapHeight('map', 'markdown', MAP_HEIGHT, false)).toBe(
      MAP_HEIGHT,
    );
    expect(getHandoffGapHeight('markdown', 'map', MAP_HEIGHT, false)).toBe(
      MAP_HEIGHT,
    );
    expect(getHandoffGapHeight('map', 'markdown', MAP_HEIGHT, true)).toBe(
      MAP_HEIGHT,
    );
  });

  it('returns zero for markdown-to-markdown when gap is disabled', () => {
    expect(getHandoffGapHeight('markdown', 'markdown', MAP_HEIGHT, false)).toBe(
      0,
    );
  });

  it('returns map height for markdown-to-markdown when gap is enabled', () => {
    expect(getHandoffGapHeight('markdown', 'markdown', MAP_HEIGHT, true)).toBe(
      MAP_HEIGHT,
    );
  });
});
