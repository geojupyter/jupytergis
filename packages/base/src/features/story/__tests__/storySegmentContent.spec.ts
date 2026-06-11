import { normalizeSegmentContentForMode } from '@/src/features/story/utils/storySegmentContent';

describe('normalizeSegmentContentForMode', () => {
  it('keeps map fields when switching to map', () => {
    expect(
      normalizeSegmentContentForMode(
        {
          contentMode: 'markdown',
          markdown: '# Hello',
          title: 'ignored',
        },
        'map',
      ),
    ).toEqual({
      contentMode: 'map',
      title: 'ignored',
      image: '',
      markdown: '# Hello',
    });
  });

  it('keeps markdown when switching to markdown', () => {
    expect(
      normalizeSegmentContentForMode(
        {
          contentMode: 'map',
          title: 'Flood stage',
          image: 'hero.png',
          markdown: 'Caption text',
        },
        'markdown',
      ),
    ).toEqual({
      contentMode: 'markdown',
      markdown: 'Caption text',
    });
  });
});
