import {
  normalizeSegmentContentForMode,
  updateSegmentContent,
} from '@/src/features/story/utils/storySegmentContent';

describe('normalizeSegmentContentForMode', () => {
  it('keeps map fields when switching to map', () => {
    expect(
      normalizeSegmentContentForMode(
        {
          contentMode: 'markdown',
          markdown: '# Hello',
          imageCaption: 'ignored',
        },
        'map',
      ),
    ).toEqual({
      contentMode: 'map',
      imageCaption: 'ignored',
      image: '',
      markdown: '# Hello',
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
        },
        'markdown',
      ),
    ).toEqual({
      contentMode: 'markdown',
      markdown: 'Caption text',
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
