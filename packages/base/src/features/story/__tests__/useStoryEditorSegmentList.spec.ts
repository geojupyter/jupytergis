/**
 * @jest-environment jsdom
 */

jest.mock('@/src/constants', () => ({
  CommandIDs: {
    addStorySegment: 'jupytergis:addStorySegment',
  },
}));

import type { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import { CommandRegistry } from '@lumino/commands';
import { Signal } from '@lumino/signaling';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { useStoryEditorSegmentList } from '@/src/features/story/hooks/useStoryEditorSegmentList';

const ADD_STORY_SEGMENT_COMMAND = 'jupytergis:addStorySegment';

interface IModelSignals {
  layersChanged: Signal<unknown, void>;
  storyMapsChanged: Signal<unknown, void>;
  currentSegmentIndexChanged: Signal<unknown, number>;
  segmentAdded: Signal<unknown, { storySegmentId: string }>;
}

function createStory(overrides: Partial<IJGISStoryMap> = {}): IJGISStoryMap {
  return {
    storyType: 'guided',
    storySegments: ['segment-1', 'segment-2'],
    ...overrides,
  };
}

function createModel(
  options: {
    story?: IJGISStoryMap | null;
    currentIndex?: number;
  } = {},
) {
  const story = options.story === undefined ? createStory() : options.story;
  const sharedModel = {};
  const layersChanged = new Signal<typeof sharedModel, void>(sharedModel);
  const storyMapsChanged = new Signal<typeof sharedModel, void>(sharedModel);

  const modelOwner = {};
  const currentSegmentIndexChanged = new Signal<typeof modelOwner, number>(
    modelOwner,
  );
  const segmentAdded = new Signal<
    typeof modelOwner,
    { storySegmentId: string }
  >(modelOwner);

  const model = {
    getSelectedStory: jest.fn(() => ({
      storyId: story ? 'story-1' : undefined,
      story: story ?? undefined,
    })),
    getCurrentSegmentIndex: jest.fn(() => options.currentIndex),
    setCurrentSegmentIndex: jest.fn(),
    getLayer: jest.fn((id: string) => ({
      name: id,
      type: 'StorySegmentLayer',
      parameters: {
        content: {
          contentMode: 'map',
          title: '',
          markdown: '',
        },
      },
    })),
    removeLayer: jest.fn(),
    sharedModel: {
      layersChanged,
      storyMapsChanged,
      updateStoryMap: jest.fn(),
    },
    currentSegmentIndexChanged,
    segmentAdded,
  };

  return {
    model: model as unknown as IJupyterGISModel,
    signals: {
      layersChanged,
      storyMapsChanged,
      currentSegmentIndexChanged,
      segmentAdded,
    } satisfies IModelSignals,
  };
}

function mountHook(model: IJupyterGISModel, commands: CommandRegistry) {
  const container = document.createElement('div');
  const root: Root = createRoot(container);
  let latest: ReturnType<typeof useStoryEditorSegmentList> | null = null;

  function Harness(): null {
    latest = useStoryEditorSegmentList(model, commands);
    return null;
  }

  act(() => {
    root.render(React.createElement(Harness));
  });

  return {
    get current() {
      if (!latest) {
        throw new Error('Hook result was not initialized');
      }
      return latest;
    },
    rerender() {
      act(() => {
        root.render(React.createElement(Harness));
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe('useStoryEditorSegmentList', () => {
  let commands: CommandRegistry;

  beforeEach(() => {
    commands = {
      execute: jest.fn(),
    } as unknown as CommandRegistry;
  });

  it('selects the first segment when the current index is unset', () => {
    const { model } = createModel({ currentIndex: undefined });
    const view = mountHook(model, commands);

    expect(view.current.selectedSegmentId).toBe('segment-1');
    expect(view.current.selectedSegment?.id).toBe('segment-1');
  });

  it('updates the current segment index when a segment is selected', () => {
    const { model } = createModel({ currentIndex: 0 });
    const view = mountHook(model, commands);

    act(() => {
      view.current.selectSegment('segment-2');
    });

    expect(model.setCurrentSegmentIndex).toHaveBeenCalledWith(1);
  });

  it('adds a segment through the add-story-segment command', () => {
    const { model } = createModel();
    const view = mountHook(model, commands);

    act(() => {
      view.current.addSegment();
    });

    expect(commands.execute).toHaveBeenCalledWith(ADD_STORY_SEGMENT_COMMAND);
  });

  it('removes the selected segment and clamps the current index', () => {
    const story = createStory();
    const { model } = createModel({ story, currentIndex: 1 });

    model.getSelectedStory = jest
      .fn()
      .mockReturnValueOnce({ storyId: 'story-1', story })
      .mockReturnValueOnce({
        storyId: 'story-1',
        story: { ...story, storySegments: ['segment-1'] },
      });

    const view = mountHook(model, commands);

    act(() => {
      view.current.removeSegment();
    });

    expect(model.removeLayer).toHaveBeenCalledWith('segment-2');
    expect(model.setCurrentSegmentIndex).toHaveBeenCalledWith(0);
  });

  it('selects a newly added segment when segmentAdded fires', () => {
    const story = createStory({ storySegments: ['segment-1'] });
    const { model, signals } = createModel({ story, currentIndex: 0 });
    mountHook(model, commands);

    model.getSelectedStory = jest.fn(() => ({
      storyId: 'story-1',
      story: {
        ...story,
        storySegments: ['segment-1', 'segment-new'],
      },
    }));

    act(() => {
      signals.segmentAdded.emit({ storySegmentId: 'segment-new' });
    });

    expect(model.setCurrentSegmentIndex).toHaveBeenCalledWith(1);
  });

  it('does not allow removing the last remaining segment', () => {
    const story = createStory({ storySegments: ['segment-1'] });
    const { model } = createModel({ story, currentIndex: 0 });
    const view = mountHook(model, commands);

    expect(view.current.canRemoveSegment).toBe(false);

    act(() => {
      view.current.removeSegment();
    });

    expect(model.removeLayer).not.toHaveBeenCalled();
  });

  it('reorders story segments', () => {
    const story = createStory();
    const { model } = createModel({ story, currentIndex: 0 });
    const view = mountHook(model, commands);

    act(() => {
      view.current.reorderSegments(0, 1);
    });

    expect(model.sharedModel.updateStoryMap).toHaveBeenCalledWith('story-1', {
      ...story,
      storySegments: ['segment-2', 'segment-1'],
    });
    expect(model.setCurrentSegmentIndex).toHaveBeenCalledWith(1);
  });
});
