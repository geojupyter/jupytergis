/**
 * @jest-environment jsdom
 */

beforeAll(() => {
  if (typeof globalThis.structuredClone !== 'function') {
    globalThis.structuredClone = <T>(value: T): T =>
      JSON.parse(JSON.stringify(value)) as T;
  }
});

jest.mock('@lumino/coreutils', () => ({
  UUID: {
    uuid4: jest.fn(() => 'new-segment-id'),
  },
}));

jest.mock('@/src/features/story/utils/storySegmentMarkdownSharedModel', () => ({
  peekStorySegmentMarkdown: jest.fn(() => undefined),
  getStorySegmentMarkdownSharedModel: jest.fn(),
  disposeSegmentMarkdown: jest.fn(),
}));

import type { IJupyterGISModel, IStorySegmentLayer } from '@jupytergis/schema';

import {
  clearStorySegmentClipboard,
  copyStorySegment,
  duplicateStorySegment,
  getStorySegmentClipboard,
  isAccelKey,
  isStoryEditorTypingTarget,
  pasteStorySegment,
  removeStorySegment,
} from '@/src/features/story/utils/storySegmentClipboard';
import {
  disposeSegmentMarkdown,
  getStorySegmentMarkdownSharedModel,
  peekStorySegmentMarkdown,
} from '@/src/features/story/utils/storySegmentMarkdownSharedModel';

const peekMarkdown = peekStorySegmentMarkdown as jest.MockedFunction<
  typeof peekStorySegmentMarkdown
>;
const seedMarkdown = getStorySegmentMarkdownSharedModel as jest.MockedFunction<
  typeof getStorySegmentMarkdownSharedModel
>;
const disposeMarkdown = disposeSegmentMarkdown as jest.MockedFunction<
  typeof disposeSegmentMarkdown
>;

function createParameters(
  overrides: Partial<IStorySegmentLayer> = {},
): IStorySegmentLayer {
  return {
    zoom: 4,
    extent: [0, 1, 2, 3],
    transition: { type: 'linear', time: 1 },
    layerOverride: [{ targetLayer: 'roads', visible: false }],
    content: {
      contentMode: 'map',
      imageCaption: 'caption',
      image: '',
      panelWidth: '25%',
    },
    ...overrides,
  };
}

function createModel(
  options: {
    layer?: ReturnType<IJupyterGISModel['getLayer']> | null;
    storySegments?: string[];
    storyId?: string | null;
  } = {},
) {
  const storySegments = options.storySegments ?? ['segment-1', 'segment-2'];
  const storyId = options.storyId === undefined ? 'story-1' : options.storyId;
  const layer =
    options.layer === undefined
      ? {
          type: 'StorySegmentLayer',
          name: 'Segment A',
          parameters: createParameters(),
        }
      : options.layer;

  const transact = jest.fn((fn: () => void) => {
    fn();
  });

  return {
    getLayer: jest.fn(() => layer),
    addLayer: jest.fn(),
    setCurrentSegmentIndex: jest.fn(),
    canRemoveStorySegment: jest.fn(() => storySegments.length > 1),
    removeStorySegment: jest.fn(() => storySegments.length > 1),
    getSelectedStory: jest.fn(() => ({
      storyId: storyId ?? undefined,
      story: storyId
        ? {
            storyType: 'guided',
            storySegments,
          }
        : undefined,
    })),
    sharedModel: {
      transact,
      updateStoryMap: jest.fn(),
    },
  } as unknown as IJupyterGISModel & {
    sharedModel: {
      transact: jest.Mock;
      updateStoryMap: jest.Mock;
    };
    addLayer: jest.Mock;
    setCurrentSegmentIndex: jest.Mock;
    canRemoveStorySegment: jest.Mock;
    removeStorySegment: jest.Mock;
  };
}

describe('isStoryEditorTypingTarget', () => {
  it('detects inputs and CodeMirror hosts', () => {
    const input = document.createElement('input');
    expect(isStoryEditorTypingTarget(input)).toBe(true);

    const host = document.createElement('div');
    host.className = 'cm-editor';
    const nested = document.createElement('span');
    host.appendChild(nested);
    document.body.appendChild(host);
    expect(isStoryEditorTypingTarget(nested)).toBe(true);

    expect(isStoryEditorTypingTarget(document.createElement('button'))).toBe(
      false,
    );
  });
});

describe('isAccelKey', () => {
  it('matches Ctrl/Cmd + key with optional Shift', () => {
    expect(
      isAccelKey(
        {
          key: 'c',
          ctrlKey: true,
          metaKey: false,
          altKey: false,
          shiftKey: false,
        },
        'c',
      ),
    ).toBe(true);

    expect(
      isAccelKey(
        {
          key: 'Z',
          ctrlKey: true,
          metaKey: false,
          altKey: false,
          shiftKey: true,
        },
        'z',
        { shift: true },
      ),
    ).toBe(true);

    expect(
      isAccelKey(
        {
          key: 'z',
          ctrlKey: true,
          metaKey: false,
          altKey: false,
          shiftKey: true,
        },
        'z',
      ),
    ).toBe(false);
  });
});

describe('storySegmentClipboard', () => {
  beforeEach(() => {
    clearStorySegmentClipboard();
    peekMarkdown.mockReset();
    peekMarkdown.mockReturnValue(undefined);
    seedMarkdown.mockReset();
  });

  it('copies a deep snapshot of the selected segment', () => {
    const parameters = createParameters();
    const model = createModel({
      layer: {
        type: 'StorySegmentLayer',
        name: 'Segment A',
        parameters,
      },
    });

    expect(copyStorySegment(model, 'segment-1')).toBe(true);

    const item = getStorySegmentClipboard();
    expect(item?.name).toBe('Segment A');
    expect(item?.parameters).toEqual(parameters);
    expect(item?.parameters).not.toBe(parameters);
    expect(item?.parameters.layerOverride).not.toBe(parameters.layerOverride);
  });

  it('prefers live Y.Text markdown over parameter markdown', () => {
    peekMarkdown.mockReturnValue('# Live');
    const model = createModel({
      layer: {
        type: 'StorySegmentLayer',
        name: 'MD',
        parameters: createParameters({
          content: {
            contentMode: 'markdown',
            markdown: '# Stale',
          },
        }),
      },
    });

    expect(copyStorySegment(model, 'segment-md')).toBe(true);
    expect(getStorySegmentClipboard()?.parameters.content?.markdown).toBe(
      '# Live',
    );
  });

  it('returns false when the layer is missing', () => {
    const model = createModel({ layer: null });
    expect(copyStorySegment(model, 'missing')).toBe(false);
    expect(getStorySegmentClipboard()).toBeNull();
  });

  it('pastes a clone after the selected segment in one transaction', () => {
    const model = createModel();
    expect(copyStorySegment(model, 'segment-1')).toBe(true);

    const newId = pasteStorySegment(model, 'segment-1');
    expect(newId).toBe('new-segment-id');
    expect(model.sharedModel.transact).toHaveBeenCalledTimes(1);
    expect(model.addLayer).toHaveBeenCalledWith(
      'new-segment-id',
      expect.objectContaining({
        type: 'StorySegmentLayer',
        name: 'Segment A Copy',
      }),
    );
    expect(model.sharedModel.updateStoryMap).toHaveBeenCalledWith('story-1', {
      storyType: 'guided',
      storySegments: ['segment-1', 'new-segment-id', 'segment-2'],
    });
    expect(model.setCurrentSegmentIndex).toHaveBeenCalledWith(1);
  });

  it('seeds markdown Y.Text when pasting markdown content', () => {
    const model = createModel({
      layer: {
        type: 'StorySegmentLayer',
        name: 'MD',
        parameters: createParameters({
          content: {
            contentMode: 'markdown',
            markdown: '# Hello',
          },
        }),
      },
    });

    expect(copyStorySegment(model, 'segment-1')).toBe(true);
    pasteStorySegment(model, 'segment-1');

    expect(seedMarkdown).toHaveBeenCalledWith(
      model,
      'new-segment-id',
      '# Hello',
    );
  });

  it('does not paste when the clipboard is empty', () => {
    const model = createModel();
    expect(pasteStorySegment(model, 'segment-1')).toBeNull();
    expect(model.addLayer).not.toHaveBeenCalled();
  });

  it('duplicates by copying then pasting after the source', () => {
    const model = createModel();
    expect(duplicateStorySegment(model, 'segment-2')).toBe('new-segment-id');
    expect(model.sharedModel.updateStoryMap).toHaveBeenCalledWith('story-1', {
      storyType: 'guided',
      storySegments: ['segment-1', 'segment-2', 'new-segment-id'],
    });
    expect(model.setCurrentSegmentIndex).toHaveBeenCalledWith(2);
  });

  it('disposes markdown then removes on the model', () => {
    const model = createModel();
    disposeMarkdown.mockClear();

    expect(removeStorySegment(model, 'segment-2')).toBe(true);
    expect(disposeMarkdown).toHaveBeenCalledWith(model, 'segment-2');
    expect(model.removeStorySegment).toHaveBeenCalledWith('segment-2');
  });

  it('does not remove the last remaining segment', () => {
    const model = createModel({ storySegments: ['segment-1'] });
    disposeMarkdown.mockClear();

    expect(removeStorySegment(model, 'segment-1')).toBe(false);
    expect(disposeMarkdown).not.toHaveBeenCalled();
    expect(model.removeStorySegment).not.toHaveBeenCalled();
  });
});
