import {
  getSegmentPaneAlignment,
  segmentPaneAlignment,
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

describe('segmentPaneAlignment', () => {
  it('maps schema values to flex align-self keywords', () => {
    expect(segmentPaneAlignment('start')).toBe('flex-start');
    expect(segmentPaneAlignment('center')).toBe('center');
    expect(segmentPaneAlignment('end')).toBe('flex-end');
  });
});

describe('normalizeSegmentContentForMode', () => {
  it('keeps map fields when switching to map', () => {
    expect(
      normalizeSegmentContentForMode(
        {
          contentMode: 'markdown',
          markdown: '# Hello',
          imageCaption: 'ignored',
          paneAlignment: 'start',
        },
        'map',
      ),
    ).toEqual({
      contentMode: 'map',
      imageCaption: 'ignored',
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
          imageCaption: 'Flood stage',
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
            imageCaption: 'Old caption',
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
        imageCaption: 'Old caption',
        markdown: 'New body',
      },
    });
  });
});
