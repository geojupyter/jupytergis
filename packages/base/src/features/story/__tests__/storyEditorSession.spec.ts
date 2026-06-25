/**
 * @jest-environment jsdom
 */

jest.mock('../utils/storySegmentMapView', () => ({
  updateSegmentMapView: jest.fn(),
}));

jest.mock('../utils/storySegmentOverrides', () => ({
  applySegmentLayerOverrides: jest.fn(),
  clearSegmentLayerOverrideEntries: jest.fn(),
}));

jest.mock('../components/StoryMapInteractionBarWidget', () => ({
  StoryMapInteractionBarWidget: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  })),
}));

jest.mock('@lumino/widgets', () => ({
  Widget: {
    attach: jest.fn(),
  },
}));

jest.mock('@/src/constants', () => ({
  CommandIDs: {
    togglePanel: 'jupytergis:togglePanel',
    openStoryEditor: 'jupytergis:openStoryEditor',
  },
}));

import { STORY_TYPE } from '@/src/types';
import { StoryMapInteractionBarWidget } from '../components/StoryMapInteractionBarWidget';
import { StoryEditorSession } from '../storyEditorSession';
import { updateSegmentMapView } from '../utils/storySegmentMapView';
import {
  applySegmentLayerOverrides,
  clearSegmentLayerOverrideEntries,
} from '../utils/storySegmentOverrides';

const TOGGLE_PANEL_COMMAND = 'jupytergis:togglePanel';

function createDialog() {
  return {
    minimize: jest.fn(),
    restore: jest.fn(),
    activate: jest.fn(),
  };
}

function createModel(overrides: Record<string, unknown> = {}) {
  return {
    centerOnPosition: jest.fn(),
    canUseStoryPreview: jest.fn(() => true),
    isStoryPreviewActive: jest.fn(() => false),
    setStoryPreviewActive: jest.fn(),
    getSelectedStory: jest.fn(() => ({
      story: { storyType: STORY_TYPE.guided },
    })),
    ...overrides,
  };
}

function createCommands() {
  return {
    execute: jest.fn(),
    isToggled: jest.fn(() => false),
    notifyCommandChanged: jest.fn(),
  } as unknown as import('@lumino/commands').CommandRegistry;
}

describe('StoryEditorSession', () => {
  let session: StoryEditorSession;

  beforeEach(() => {
    session = StoryEditorSession.getInstance();
    session.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    session.clear();
  });

  it('reports inactive until a dialog is attached', () => {
    const model = createModel();

    expect(session.isActiveFor(model as never)).toBe(false);
    expect(session.isMapInteractionMode()).toBe(false);
  });

  it('enters map view mode and applies the segment view', () => {
    const dialog = createDialog();
    const model = createModel();
    const commands = createCommands();

    session.attachDialog(dialog as never, model as never, commands, null);
    session.enterMapViewMode('segment-1');

    expect(session.isMapViewMode()).toBe(true);
    expect(model.centerOnPosition).toHaveBeenCalledWith('segment-1');
    expect(dialog.minimize).toHaveBeenCalled();
    expect(commands.execute).toHaveBeenCalledWith(TOGGLE_PANEL_COMMAND);

    session.applyMapView();

    expect(updateSegmentMapView).toHaveBeenCalledWith(model, 'segment-1');
    expect(dialog.restore).toHaveBeenCalled();
    expect(session.isMapInteractionMode()).toBe(false);
  });

  it('previews a segment and clears overrides when restored', () => {
    const dialog = createDialog();
    const model = createModel();
    const commands = createCommands();

    session.attachDialog(dialog as never, model as never, commands, null);
    session.enterPreviewMode('segment-2');

    expect(session.isPreviewingSegment()).toBe(true);
    expect(applySegmentLayerOverrides).toHaveBeenCalledWith(
      model,
      'segment-2',
      [],
    );
    expect(dialog.minimize).toHaveBeenCalled();
    expect(commands.execute).toHaveBeenCalledWith(TOGGLE_PANEL_COMMAND);

    session.restoreEditor();

    expect(clearSegmentLayerOverrideEntries).toHaveBeenCalledWith(model, []);
    expect(dialog.restore).toHaveBeenCalled();
    expect(session.isMapInteractionMode()).toBe(false);
  });

  it('clears preview overrides when the dialog is dismissed', () => {
    const dialog = createDialog();
    const model = createModel();
    const commands = createCommands();

    session.attachDialog(dialog as never, model as never, commands, null);
    session.enterPreviewMode('segment-3');
    session.clear();

    expect(clearSegmentLayerOverrideEntries).toHaveBeenCalledWith(model, []);
    expect(session.isActiveFor(model as never)).toBe(false);
  });

  it('enters story preview mode and restores the editor when preview ends', () => {
    const dialog = createDialog();
    const model = createModel({
      isStoryPreviewActive: jest.fn(() => true),
    });
    const commands = createCommands();

    session.attachDialog(dialog as never, model as never, commands, null);
    session.enterStoryPreviewMode();

    expect(session.isPreviewingStory()).toBe(true);
    expect(model.setStoryPreviewActive).toHaveBeenCalledWith(true);
    expect(dialog.minimize).toHaveBeenCalled();
    expect(StoryMapInteractionBarWidget).toHaveBeenCalledWith(
      expect.objectContaining({ placement: 'main-top-left' }),
    );
    expect(commands.execute).not.toHaveBeenCalled();

    session.restoreEditor();

    expect(model.setStoryPreviewActive).toHaveBeenCalledWith(false);
    expect(dialog.restore).toHaveBeenCalled();
    expect(session.isMapInteractionMode()).toBe(false);
    expect(commands.execute).not.toHaveBeenCalled();
  });

  it('uses bottom-center bar placement for non-guided story preview', () => {
    const dialog = createDialog();
    const model = createModel({
      getSelectedStory: jest.fn(() => ({
        story: { storyType: STORY_TYPE.verticalScroll },
      })),
    });
    const commands = createCommands();

    session.attachDialog(dialog as never, model as never, commands, null);
    session.enterStoryPreviewMode();

    expect(StoryMapInteractionBarWidget).toHaveBeenCalledWith(
      expect.objectContaining({ placement: 'overlay-bottom' }),
    );
  });
});
