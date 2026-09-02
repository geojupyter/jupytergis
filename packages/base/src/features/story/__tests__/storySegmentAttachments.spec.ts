import {
  formatSegmentAttachmentMarkdown,
  generateSegmentAttachmentUri,
  getSegmentAttachments,
  setSegmentAttachment,
} from '@/src/features/story/utils/storySegmentAttachments';
import { updateSegmentContent } from '@/src/features/story/utils/storySegmentContent';

describe('storySegmentAttachments', () => {
  it('reads and writes attachments on segment content', () => {
    const updateObjectParameters = jest.fn();
    const model = {
      getLayer: jest.fn(() => ({
        type: 'StorySegmentLayer',
        parameters: {
          content: {
            contentMode: 'markdown',
            markdown: '# Hello',
            attachments: {
              'plot.png': { 'image/png': 'abc123' },
            },
          },
        },
      })),
      sharedModel: { updateObjectParameters },
    };

    expect(getSegmentAttachments(model as never, 'segment-1')).toEqual({
      'plot.png': { 'image/png': 'abc123' },
    });

    setSegmentAttachment(model as never, 'segment-1', 'new.png', {
      'image/png': 'def456',
    });

    expect(updateObjectParameters).toHaveBeenCalledWith('segment-1', {
      content: {
        contentMode: 'markdown',
        markdown: '# Hello',
        attachments: {
          'plot.png': { 'image/png': 'abc123' },
          'new.png': { 'image/png': 'def456' },
        },
      },
    });
  });

  it('formats attachment markdown links', () => {
    expect(formatSegmentAttachmentMarkdown('plot.png', 'uuid.png')).toBe(
      '![plot.png](attachment:uuid.png)',
    );
  });

  it('generates attachment uris with preserved extensions', () => {
    const uri = generateSegmentAttachmentUri('plot.png');
    expect(uri.endsWith('.png')).toBe(true);
    expect(uri.length).toBeGreaterThan('.png'.length);
  });
});

describe('updateSegmentContent attachments patch', () => {
  it('merges attachments into segment content', () => {
    const updateObjectParameters = jest.fn();
    const model = {
      getLayer: jest.fn(() => ({
        type: 'StorySegmentLayer',
        parameters: {
          content: {
            contentMode: 'markdown',
            markdown: 'Old body',
          },
        },
      })),
      sharedModel: { updateObjectParameters },
    };

    updateSegmentContent(model as never, 'segment-1', {
      attachments: { 'a.png': { 'image/png': 'x' } },
    });

    expect(updateObjectParameters).toHaveBeenCalledWith('segment-1', {
      content: {
        contentMode: 'markdown',
        markdown: 'Old body',
        attachments: { 'a.png': { 'image/png': 'x' } },
      },
    });
  });
});
