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
    node: document.createElement('div'),
  })),
}));

jest.mock('../storyEditorDialog', () => ({
  StoryEditorWidget: jest.fn().mockImplementation(() => ({
    launch: jest.fn().mockResolvedValue({}),
    close: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    activate: jest.fn(),
    dispose: jest.fn(),
  })),
}));

jest.mock('@lumino/widgets', () => ({
  Widget: {
    attach: jest.fn(),
  },
}));

jest.mock('@/src/workspace/widget', () => ({
  JupyterGISPanel: class JupyterGISPanel {},
}));

jest.mock('@/src/constants', () => ({
  CommandIDs: {
    togglePanel: 'jupytergis:togglePanel',
    toggleLeftPanel: 'jupytergis:toggleLeftPanel',
    toggleRightPanel: 'jupytergis:toggleRightPanel',
    openStoryEditor: 'jupytergis:openStoryEditor',
  },
}));

import { Widget } from '@lumino/widgets';

import { STORY_TYPE } from '@/src/types';
import { StoryMapInteractionBarWidget } from '../components/StoryMapInteractionBarWidget';
import { StoryEditorWidget } from '../storyEditorDialog';
import { StoryEditorMode, StoryEditorSession } from '../storyEditorSession';
import {
  attachSession,
  createCommands,
  createDialog,
  createModel,
  createTracker,
  notifyTrackerTabChange,
} from './storyTestFixtures';
import { updateSegmentMapView } from '../utils/storySegmentMapView';
import {
  applySegmentLayerOverrides,
  clearSegmentLayerOverrideEntries,
} from '../utils/storySegmentOverrides';

const TOGGLE_PANEL_COMMAND = 'jupytergis:togglePanel';

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

  describe('modes', () => {
    it('reports inactive until a dialog is attached', () => {
      const model = createModel();

      expect(session.getMode(model as never)).toBe(StoryEditorMode.inactive);
      expect(session.hasActiveInteraction()).toBe(false);
    });

    it('enters map view mode and applies the segment view', () => {
      const dialog = createDialog();
      const model = createModel();
      const commands = createCommands();

      attachSession(session, dialog, model, commands);
      session.enterMapViewMode('segment-1');

      expect(session.getMode(model as never)).toBe(StoryEditorMode.mapView);
      expect(model.centerOnPosition).toHaveBeenCalledWith('segment-1');
      expect(dialog.close).toHaveBeenCalled();
      expect(model.setUIState).toHaveBeenCalledWith({
        leftPanelOpen: false,
        rightPanelOpen: false,
      });
      expect(commands.notifyCommandChanged).toHaveBeenCalledWith(
        TOGGLE_PANEL_COMMAND,
      );

      session.applyMapView();

      expect(updateSegmentMapView).toHaveBeenCalledWith(model, 'segment-1');
      expect(StoryEditorWidget).toHaveBeenCalled();
      expect(model.setUIState).toHaveBeenCalledWith({
        leftPanelOpen: true,
        rightPanelOpen: true,
      });
    });

    it('previews a segment and clears overrides when restored', () => {
      const dialog = createDialog();
      const model = createModel();
      const commands = createCommands();

      attachSession(session, dialog, model, commands);
      session.enterPreviewMode('segment-2');

      expect(session.getMode(model as never)).toBe(
        StoryEditorMode.segmentPreview,
      );
      expect(applySegmentLayerOverrides).toHaveBeenCalledWith(
        model,
        'segment-2',
        [],
      );
      expect(dialog.close).toHaveBeenCalled();

      session.restoreEditor();

      expect(clearSegmentLayerOverrideEntries).toHaveBeenCalledWith(model, []);
      expect(StoryEditorWidget).toHaveBeenCalled();
      expect(session.hasActiveInteraction()).toBe(false);
    });

    it('enters story preview mode and restores the editor when preview ends', () => {
      const dialog = createDialog();
      const model = createModel({
        getSelectedStory: jest.fn(() => ({
          story: { storyType: STORY_TYPE.guided, title: 'My Story' },
        })),
      });
      const commands = createCommands();

      attachSession(session, dialog, model, commands);
      session.enterStoryPreviewMode();

      expect(session.getMode(model as never)).toBe(
        StoryEditorMode.storyPreview,
      );
      expect(model.setStoryPreviewActive).toHaveBeenCalledWith(true);
      expect(dialog.close).toHaveBeenCalled();
      expect(StoryMapInteractionBarWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Previewing "My Story"',
          placement: 'main-top-left',
        }),
      );

      session.restoreEditor();

      expect(model.setStoryPreviewActive).toHaveBeenCalledWith(false);
      expect(StoryEditorWidget).toHaveBeenCalled();
      expect(session.hasActiveInteraction()).toBe(false);
    });
  });

  describe('session lifecycle', () => {
    it('keeps the session alive when the dialog closes during map interaction', () => {
      const dialog = createDialog();
      const model = createModel();
      const commands = createCommands();

      attachSession(session, dialog, model, commands);
      session.enterMapViewMode('segment-1');
      session.onDialogDisposed(model as never);

      expect(session.getMode(model as never)).toBe(StoryEditorMode.mapView);
    });

    it('clears preview overrides when the session is cleared', () => {
      const dialog = createDialog();
      const model = createModel();
      const commands = createCommands();

      attachSession(session, dialog, model, commands);
      session.enterPreviewMode('segment-3');
      session.clear();

      expect(clearSegmentLayerOverrideEntries).toHaveBeenCalledWith(model, []);
      expect(session.getMode(model as never)).toBe(StoryEditorMode.inactive);
    });

    it('does not tear down the session when the dialog closes while another tab previews', () => {
      const dialog = createDialog();
      const modelA = createModel({
        filePath: 'a.jGIS',
        isStoryPreviewActive: jest.fn(() => true),
      });
      const modelB = createModel({ filePath: 'b.jGIS' });
      const commands = createCommands();
      const tracker = createTracker(modelB, [modelA]);

      attachSession(session, dialog, modelB, commands, tracker);
      tracker.currentChanged.disconnect.mockClear();
      session.closeEditorIfIdle();

      expect(session.getMode(modelB as never)).toBe(StoryEditorMode.inactive);
      expect(tracker.currentChanged.disconnect).not.toHaveBeenCalled();
    });

    it('closes the previous dialog when opening the editor on another model', () => {
      const dialogA = createDialog();
      const dialogB = createDialog();
      const modelA = createModel({ filePath: 'a.jGIS' });
      const modelB = createModel({ filePath: 'b.jGIS' });
      const commands = createCommands();
      const tracker = createTracker(modelA, [modelB]);

      attachSession(session, dialogA, modelA, commands, tracker);
      expect(session.getMode(modelA as never)).toBe(StoryEditorMode.editing);

      attachSession(session, dialogB, modelB, commands, tracker);
      expect(dialogA.close).toHaveBeenCalled();
      expect(session.getMode(modelA as never)).toBe(StoryEditorMode.inactive);
      expect(session.getMode(modelB as never)).toBe(StoryEditorMode.editing);
    });
  });

  describe('multi-tab story preview', () => {
    it('creates a preview bar when switching to another tab that is already previewing', () => {
      const dialog = createDialog();
      const modelA = createModel({
        filePath: 'a.jGIS',
        isStoryPreviewActive: jest.fn(() => true),
        getSelectedStory: jest.fn(() => ({
          story: { storyType: STORY_TYPE.verticalScroll, title: 'Story A' },
        })),
      });
      const modelB = createModel({
        filePath: 'b.jGIS',
        getSelectedStory: jest.fn(() => ({
          story: { storyType: STORY_TYPE.verticalScroll, title: 'Story B' },
        })),
      });
      const commands = createCommands();
      const tracker = createTracker(modelB, [modelA]);
      const parentA = document.createElement('div');
      const parentB = document.createElement('div');

      attachSession(session, dialog, modelB, commands, tracker);
      session.enterStoryPreviewMode();

      tracker.configureMainViewParents(model =>
        model === modelA ? parentA : parentB,
      );
      tracker.setActiveModel(modelA);
      notifyTrackerTabChange(session);

      expect(StoryMapInteractionBarWidget).toHaveBeenLastCalledWith(
        expect.objectContaining({
          message: 'Previewing "Story A"',
        }),
      );
      expect(Widget.attach).toHaveBeenCalledWith(
        expect.objectContaining({ node: expect.any(HTMLElement) }),
        parentA,
      );
    });

    it('restores the preview bar on tab A after exiting preview on tab B', () => {
      const dialog = createDialog();
      const modelA = createModel({
        filePath: 'a.jGIS',
        isStoryPreviewActive: jest.fn(() => true),
        getSelectedStory: jest.fn(() => ({
          story: { storyType: STORY_TYPE.verticalScroll, title: 'Story A' },
        })),
      });
      const modelB = createModel({
        filePath: 'b.jGIS',
        isStoryPreviewActive: jest.fn(() => true),
        getSelectedStory: jest.fn(() => ({
          story: { storyType: STORY_TYPE.verticalScroll, title: 'Story B' },
        })),
      });
      const commands = createCommands();
      const tracker = createTracker(modelA, [modelB]);
      const parentA = document.createElement('div');
      const parentB = document.createElement('div');

      attachSession(session, dialog, modelA, commands, tracker);
      session.enterStoryPreviewMode();

      const mapBarA = (StoryMapInteractionBarWidget as jest.Mock).mock
        .results[0].value as { show: jest.Mock };

      tracker.configureMainViewParents(model =>
        model === modelA ? parentA : parentB,
      );
      tracker.setActiveModel(modelB);
      notifyTrackerTabChange(session);
      session.restoreEditor();

      modelB.isStoryPreviewActive = jest.fn(() => false);
      mapBarA.show.mockClear();
      tracker.setActiveModel(modelA);
      notifyTrackerTabChange(session);

      expect(StoryMapInteractionBarWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Previewing "Story A"',
        }),
      );
      expect(mapBarA.show).toHaveBeenCalled();
    });

    it('opens the editor on the active tab when exiting its story preview', () => {
      const dialog = createDialog();
      const modelA = createModel({ filePath: 'a.jGIS' });
      const modelB = createModel({ filePath: 'b.jGIS' });
      const commands = createCommands();
      const tracker = createTracker(modelA, [modelB]);

      attachSession(session, dialog, modelA, commands, tracker);
      session.enterStoryPreviewMode();
      modelB.setStoryPreviewActive(true);

      jest.mocked(StoryEditorWidget).mockClear();
      session.restoreEditor();

      expect(StoryEditorWidget).toHaveBeenCalledWith(
        expect.objectContaining({ model: modelA }),
      );
    });

    it('opens the editor when exiting orphan preview on the active tab', () => {
      const dialog = createDialog();
      const modelA = createModel({ filePath: 'a.jGIS' });
      const modelB = createModel({ filePath: 'b.jGIS' });
      const commands = createCommands();
      const tracker = createTracker(modelA, [modelB]);

      attachSession(session, dialog, modelA, commands, tracker);
      session.enterStoryPreviewMode();
      modelB.setStoryPreviewActive(true);
      session.restoreEditor();

      jest.mocked(StoryEditorWidget).mockClear();
      tracker.setActiveModel(modelB);
      session.restoreEditor();

      expect(StoryEditorWidget).toHaveBeenCalledWith(
        expect.objectContaining({ model: modelB }),
      );
    });

    it('shows the preview bar on tab A after exiting session-owned preview on tab B', () => {
      const dialog = createDialog();
      const modelA = createModel({
        filePath: 'a.jGIS',
        getSelectedStory: jest.fn(() => ({
          story: { storyType: STORY_TYPE.guided, title: 'Story A' },
        })),
      });
      const modelB = createModel({
        filePath: 'b.jGIS',
        getSelectedStory: jest.fn(() => ({
          story: { storyType: STORY_TYPE.verticalScroll, title: 'Story B' },
        })),
      });
      const commands = createCommands();
      const tracker = createTracker(modelB, [modelA]);
      const parentA = document.createElement('div');

      attachSession(session, dialog, modelB, commands, tracker);
      session.enterStoryPreviewMode();
      modelA.setStoryPreviewActive(true);

      tracker.configureMainViewParents(model =>
        model === modelA ? parentA : document.createElement('div'),
      );
      tracker.setActiveModel(modelB);
      session.restoreEditor();

      jest.mocked(StoryEditorWidget).mockClear();
      tracker.setActiveModel(modelA);
      notifyTrackerTabChange(session);

      expect(StoryMapInteractionBarWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Previewing "Story A"',
        }),
      );
      expect(Widget.attach).toHaveBeenCalledWith(
        expect.objectContaining({ node: expect.any(HTMLElement) }),
        parentA,
      );
    });
  });

  describe('multi-tab map interaction', () => {
    it('hides panels per model when each tab enters map view from the editor', () => {
      const dialogA = createDialog();
      const dialogB = createDialog();
      const modelA = createModel({ filePath: 'a.jGIS' });
      const modelB = createModel({ filePath: 'b.jGIS' });
      const commands = createCommands();
      const tracker = createTracker(modelA, [modelB]);

      attachSession(session, dialogA, modelA, commands, tracker);
      session.enterMapViewMode('segment-a');
      expect(modelA.setUIState).toHaveBeenCalledWith({
        leftPanelOpen: false,
        rightPanelOpen: false,
      });

      attachSession(session, dialogB, modelB, commands, tracker);
      tracker.setActiveModel(modelB);
      session.enterMapViewMode('segment-b');
      expect(modelB.setUIState).toHaveBeenCalledWith({
        leftPanelOpen: false,
        rightPanelOpen: false,
      });
    });

    it('keeps map view state on both tabs when each enters map view from the editor', () => {
      const dialogA = createDialog();
      const dialogB = createDialog();
      const modelA = createModel({ filePath: 'a.jGIS' });
      const modelB = createModel({ filePath: 'b.jGIS' });
      const commands = createCommands();
      const tracker = createTracker(modelA, [modelB]);

      attachSession(session, dialogA, modelA, commands, tracker);
      session.enterMapViewMode('segment-a');

      attachSession(session, dialogB, modelB, commands, tracker);
      tracker.setActiveModel(modelB);
      session.enterMapViewMode('segment-b');

      tracker.setActiveModel(modelA);
      notifyTrackerTabChange(session);

      expect(session.getMode(modelA as never)).toBe(StoryEditorMode.mapView);
      expect(session.getMode(modelB as never)).toBe(StoryEditorMode.mapView);
      expect(StoryMapInteractionBarWidget).toHaveBeenCalledTimes(2);
    });
  });
});
