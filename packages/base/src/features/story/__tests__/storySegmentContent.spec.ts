import {
  getSegmentPaneAlignment,
  mapPaneAlignmentToAlignSelf,
  normalizeSegmentContentForMode,
  updateSegmentContent,
} from '@/src/features/story/utils/storySegmentContent';

describe('getSegmentPaneAlignment', () => {
  it('uses stored alignment when set', () => {
    expect(
      getSegmentPaneAlignment(
        { contentMode: 'map', paneAlignment: 'start' },
        'map',
      ),
    ).toBe('start');
  });

  it('falls back to end for map segments without alignment', () => {
    expect(getSegmentPaneAlignment({ contentMode: 'map' }, 'map')).toBe('end');
  });

  it('falls back to center for markdown segments without alignment', () => {
    expect(
      getSegmentPaneAlignment({ contentMode: 'markdown' }, 'markdown'),
    ).toBe('center');
  });
});

describe('mapPaneAlignmentToAlignSelf', () => {
  it('maps schema values to flex align-self keywords', () => {
    expect(mapPaneAlignmentToAlignSelf('start')).toBe('flex-start');
    expect(mapPaneAlignmentToAlignSelf('center')).toBe('center');
    expect(mapPaneAlignmentToAlignSelf('end')).toBe('flex-end');
  });
});

describe('normalizeSegmentContentForMode', () => {
  it('keeps map fields when switching to map', () => {
    expect(
      normalizeSegmentContentForMode(
        {
          contentMode: 'markdown',
          markdown: '# Hello',
          title: 'ignored',
          paneAlignment: 'start',
        },
        'map',
      ),
    ).toEqual({
      contentMode: 'map',
      title: 'ignored',
      image: '',
      markdown: '# Hello',
      paneAlignment: 'start',
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
          paneAlignment: 'end',
        },
        'markdown',
      ),
    ).toEqual({
      contentMode: 'markdown',
      markdown: 'Caption text',
      paneAlignment: 'end',
    });
  });
});

describe('updateSegmentContent', () => {
  it('merges content fields on the segment layer', () => {
    const updateObjectParameters = jest.fn();
    const model = {
      getLayer: jest.fn(() => ({
        type: 'StorySegmentLayer',
        parameters: {
          content: {
            contentMode: 'map',
            title: 'Old title',
            markdown: 'Old body',
          },
        },
      })),
      sharedModel: { updateObjectParameters },
    };

    updateSegmentContent(model as never, 'segment-1', {
      markdown: 'New body',
    });

    expect(updateObjectParameters).toHaveBeenCalledWith('segment-1', {
      content: {
        contentMode: 'map',
        title: 'Old title',
        markdown: 'New body',
      },
    });
  });
});
