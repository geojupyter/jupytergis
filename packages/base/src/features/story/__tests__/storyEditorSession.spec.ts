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
    reject: jest.fn(),
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

jest.mock('../utils/resolveMainViewContainer', () => ({
  resolveMainViewContainer: jest.fn(() => null),
}));

jest.mock('@/src/constants', () => ({
  CommandIDs: {
    togglePanel: 'jupytergis:togglePanel',
    toggleLeftPanel: 'jupytergis:toggleLeftPanel',
    toggleRightPanel: 'jupytergis:toggleRightPanel',
    openStoryEditor: 'jupytergis:openStoryEditor',
  },
}));

import { STORY_TYPE } from '@/src/types';
import { Widget } from '@lumino/widgets';
import { StoryEditorWidget } from '../storyEditorDialog';
import { StoryMapInteractionBarWidget } from '../components/StoryMapInteractionBarWidget';
import { resolveMainViewContainer } from '../utils/resolveMainViewContainer';
import { StoryEditorSession } from '../storyEditorSession';
import { updateSegmentMapView } from '../utils/storySegmentMapView';
import {
  applySegmentLayerOverrides,
  clearSegmentLayerOverrideEntries,
} from '../utils/storySegmentOverrides';

const TOGGLE_PANEL_COMMAND = 'jupytergis:togglePanel';

function createDialog() {
  return {
    reject: jest.fn(),
    launch: jest.fn().mockResolvedValue({}),
    show: jest.fn(),
    hide: jest.fn(),
    activate: jest.fn(),
    dispose: jest.fn(),
  };
}

function createModel(overrides: Record<string, unknown> = {}) {
  let storyPreviewActive = false;
  let uiState = { leftPanelOpen: true, rightPanelOpen: true };
  const storyPreviewActiveChanged = {
    connect: jest.fn(),
    disconnect: jest.fn(),
  };

  return {
    centerOnPosition: jest.fn(),
    canUseStoryPreview: jest.fn(() => true),
    isStoryPreviewActive: jest.fn(() => storyPreviewActive),
    setStoryPreviewActive: jest.fn((active: boolean) => {
      storyPreviewActive = active;
    }),
    storyPreviewActiveChanged,
    jgisSettings: {
      leftPanelDisabled: false,
      rightPanelDisabled: false,
    },
    getUIState: jest.fn(() => uiState),
    setUIState: jest.fn((partial: Partial<typeof uiState>) => {
      uiState = { ...uiState, ...partial };
    }),
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

function createTracker(
  model: ReturnType<typeof createModel>,
  extraModels: ReturnType<typeof createModel>[] = [],
) {
  const widgets = [
    { model },
    ...extraModels.map(extraModel => ({ model: extraModel })),
  ];
  const currentChanged = {
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
  const widgetAdded = {
    connect: jest.fn(),
    disconnect: jest.fn(),
  };

  return {
    currentWidget: { model },
    currentChanged,
    widgetAdded,
    find: jest.fn((predicate: (widget: { model: typeof model }) => boolean) =>
      widgets.find(predicate),
    ),
    forEach: (fn: (widget: { model: typeof model }) => void) => {
      for (const widget of widgets) {
        fn(widget);
      }
    },
    [Symbol.iterator]: function* () {
      for (const widget of widgets) {
        yield widget;
      }
    },
  };
}

function attachSession(
  session: StoryEditorSession,
  dialog: ReturnType<typeof createDialog>,
  model: ReturnType<typeof createModel>,
  commands: ReturnType<typeof createCommands>,
  tracker = createTracker(model),
): ReturnType<typeof createTracker> {
  const container = document.createElement('div');
  session.attachDialog(
    dialog as never,
    model as never,
    commands,
    container,
    {} as never,
    {} as never,
    tracker as never,
  );
  return tracker;
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

  it('enters map view mode and applies the segment view', async () => {
    const dialog = createDialog();
    const model = createModel();
    const commands = createCommands();

    attachSession(session, dialog, model, commands);
    session.enterMapViewMode('segment-1');

    expect(session.isMapViewMode()).toBe(true);
    expect(session.isActiveFor(model as never)).toBe(true);
    expect(model.centerOnPosition).toHaveBeenCalledWith('segment-1');
    expect(dialog.reject).toHaveBeenCalled();
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

    expect(session.isPreviewingSegment()).toBe(true);
    expect(applySegmentLayerOverrides).toHaveBeenCalledWith(
      model,
      'segment-2',
      [],
    );
    expect(dialog.reject).toHaveBeenCalled();
    expect(model.setUIState).toHaveBeenCalledWith({
      leftPanelOpen: false,
      rightPanelOpen: false,
    });

    session.restoreEditor();

    expect(clearSegmentLayerOverrideEntries).toHaveBeenCalledWith(model, []);
    expect(StoryEditorWidget).toHaveBeenCalled();
    expect(model.setUIState).toHaveBeenCalledWith({
      leftPanelOpen: true,
      rightPanelOpen: true,
    });
    expect(session.isMapInteractionMode()).toBe(false);
  });

  it('keeps the session alive when the dialog closes during map interaction', () => {
    const dialog = createDialog();
    const model = createModel();
    const commands = createCommands();

    attachSession(session, dialog, model, commands);
    session.enterMapViewMode('segment-1');
    session.onDialogDisposed(model as never);

    expect(session.isMapViewMode()).toBe(true);
    expect(session.isActiveFor(model as never)).toBe(true);
  });

  it('clears preview overrides when the dialog is dismissed', () => {
    const dialog = createDialog();
    const model = createModel();
    const commands = createCommands();

    attachSession(session, dialog, model, commands);
    session.enterPreviewMode('segment-3');
    session.clear();

    expect(clearSegmentLayerOverrideEntries).toHaveBeenCalledWith(model, []);
    expect(session.isActiveFor(model as never)).toBe(false);
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

    expect(session.isPreviewingStory()).toBe(true);
    expect(model.setStoryPreviewActive).toHaveBeenCalledWith(true);
    expect(dialog.reject).toHaveBeenCalled();
    expect(StoryMapInteractionBarWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Previewing "My Story".',
        placement: 'main-top-left',
      }),
    );
    expect(commands.execute).not.toHaveBeenCalled();

    session.restoreEditor();

    expect(model.setStoryPreviewActive).toHaveBeenCalledWith(false);
    expect(StoryEditorWidget).toHaveBeenCalled();
    expect(session.isMapInteractionMode()).toBe(false);
    expect(commands.execute).not.toHaveBeenCalled();
  });

  it('hides and shows the map bar when switching preview tabs', () => {
    const dialog = createDialog();
    const model = createModel();
    const otherModel = createModel();
    const commands = createCommands();
    const tracker = createTracker(model);

    attachSession(session, dialog, model, commands, tracker);
    session.enterStoryPreviewMode();
    model.isStoryPreviewActive = jest.fn(() => true);

    const mapBar = (StoryMapInteractionBarWidget as jest.Mock).mock.results[0]
      .value as {
      show: jest.Mock;
      hide: jest.Mock;
      node: HTMLElement;
    };
    mapBar.show.mockClear();
    jest.mocked(Widget.attach).mockClear();

    tracker.currentWidget = { model: otherModel };
    session['_onTrackerCurrentChanged']();
    expect(mapBar.hide).toHaveBeenCalled();
    expect(Widget.attach).not.toHaveBeenCalled();

    tracker.currentWidget = { model };
    session['_onTrackerCurrentChanged']();

    expect(Widget.attach).not.toHaveBeenCalled();
    expect(mapBar.show).toHaveBeenCalled();
  });

  it('uses bottom-center bar placement for non-guided story preview', () => {
    const dialog = createDialog();
    const model = createModel({
      getSelectedStory: jest.fn(() => ({
        story: { storyType: STORY_TYPE.verticalScroll },
      })),
    });
    const commands = createCommands();

    attachSession(session, dialog, model, commands);
    session.enterStoryPreviewMode();

    expect(StoryMapInteractionBarWidget).toHaveBeenCalledWith(
      expect.objectContaining({ placement: 'overlay-bottom' }),
    );
  });

  it('shows story preview bar for a tab whose model is not the session owner', () => {
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
    const tracker = createTracker(modelB);
    const parentA = document.createElement('div');
    const parentB = document.createElement('div');

    attachSession(session, dialog, modelB, commands, tracker);
    session.enterStoryPreviewMode();

    jest
      .mocked(resolveMainViewContainer)
      .mockImplementation((_tracker, model) =>
        model === modelA ? parentA : parentB,
      );

    tracker.currentWidget = { model: modelA };
    session['_onTrackerCurrentChanged']();

    expect(StoryMapInteractionBarWidget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: 'Previewing "Story A".',
      }),
    );
    expect(Widget.attach).toHaveBeenCalledWith(
      expect.objectContaining({ node: expect.any(HTMLElement) }),
      parentA,
    );
  });

  it('restores the preview bar on another tab after orphan preview exits', () => {
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

    const mapBarA = (StoryMapInteractionBarWidget as jest.Mock).mock.results[0]
      .value as {
      show: jest.Mock;
      hide: jest.Mock;
    };

    jest
      .mocked(resolveMainViewContainer)
      .mockImplementation((_tracker, model) =>
        model === modelA ? parentA : parentB,
      );

    tracker.currentWidget = { model: modelB };
    session['_onTrackerCurrentChanged']();
    session['_exitStoryPreviewForModel'](modelB);

    modelB.isStoryPreviewActive = jest.fn(() => false);
    mapBarA.show.mockClear();
    tracker.currentWidget = { model: modelA };
    session['_onTrackerCurrentChanged']();

    expect(StoryMapInteractionBarWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Previewing "Story A".',
      }),
    );
    expect(mapBarA.show).toHaveBeenCalled();
    expect(Widget.attach).toHaveBeenCalledWith(
      expect.objectContaining({ node: expect.any(HTMLElement) }),
      parentA,
    );
  });

  it('does not clear the session when the editor closes while another tab previews', () => {
    const dialog = createDialog();
    const modelA = createModel({
      filePath: 'a.jGIS',
      isStoryPreviewActive: jest.fn(() => true),
    });
    const modelB = createModel({
      filePath: 'b.jGIS',
      isStoryPreviewActive: jest.fn(() => false),
    });
    const commands = createCommands();
    const tracker = createTracker(modelB, [modelA]);

    attachSession(session, dialog, modelB, commands, tracker);
    tracker.currentChanged.disconnect.mockClear();
    session.closeEditorIfIdle();

    expect(session.isActiveFor(modelB as never)).toBe(false);
    expect(tracker.currentChanged.disconnect).not.toHaveBeenCalled();
  });

  it('restores the preview bar on tab A after exiting session-owned preview on tab B', () => {
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

    jest
      .mocked(resolveMainViewContainer)
      .mockImplementation((_tracker, model) =>
        model === modelA ? parentA : document.createElement('div'),
      );

    tracker.currentWidget = { model: modelB };
    session.restoreEditor();

    expect(StoryEditorWidget).toHaveBeenCalledWith(
      expect.objectContaining({ model: modelB }),
    );

    jest.mocked(StoryEditorWidget).mockClear();
    tracker.currentWidget = { model: modelA };
    session['_onTrackerCurrentChanged']();
    expect(StoryMapInteractionBarWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Previewing "Story A".',
      }),
    );
    expect(Widget.attach).toHaveBeenCalledWith(
      expect.objectContaining({ node: expect.any(HTMLElement) }),
      parentA,
    );
  });

  it('tracks an open dialog per model', () => {
    const dialogA = createDialog();
    const dialogB = createDialog();
    const modelA = createModel({ filePath: 'a.jGIS' });
    const modelB = createModel({ filePath: 'b.jGIS' });
    const commands = createCommands();
    const tracker = createTracker(modelA, [modelB]);

    attachSession(session, dialogA, modelA, commands, tracker);
    expect(session.isActiveFor(modelA as never)).toBe(true);
    expect(session.isActiveFor(modelB as never)).toBe(false);

    attachSession(session, dialogB, modelB, commands, tracker);
    expect(dialogA.hide).toHaveBeenCalled();
    expect(session.isActiveFor(modelA as never)).toBe(true);
    expect(session.isActiveFor(modelB as never)).toBe(true);
  });

  it('shows the parked dialog when returning to its tab', () => {
    const dialogA = createDialog();
    const dialogB = createDialog();
    const modelA = createModel({ filePath: 'a.jGIS' });
    const modelB = createModel({ filePath: 'b.jGIS' });
    const commands = createCommands();
    const tracker = createTracker(modelA, [modelB]);

    attachSession(session, dialogA, modelA, commands, tracker);
    attachSession(session, dialogB, modelB, commands, tracker);

    dialogA.show.mockClear();
    dialogB.hide.mockClear();
    tracker.currentWidget = { model: modelA };
    session['_onTrackerCurrentChanged']();

    expect(dialogA.show).toHaveBeenCalled();
    expect(dialogB.hide).toHaveBeenCalled();
  });

  it('hides panels per model when each tab enters map view mode', () => {
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
    session.enterMapViewMode('segment-b');
    expect(modelB.setUIState).toHaveBeenCalledWith({
      leftPanelOpen: false,
      rightPanelOpen: false,
    });
  });

  it('keeps map view bars on both tabs when each tab enters map view mode', () => {
    const dialogA = createDialog();
    const dialogB = createDialog();
    const modelA = createModel({ filePath: 'a.jGIS' });
    const modelB = createModel({ filePath: 'b.jGIS' });
    const commands = createCommands();
    const tracker = createTracker(modelA, [modelB]);

    attachSession(session, dialogA, modelA, commands, tracker);
    session.enterMapViewMode('segment-a');

    const barA = (StoryMapInteractionBarWidget as jest.Mock).mock.results[0]
      .value as { show: jest.Mock; hide: jest.Mock };

    attachSession(session, dialogB, modelB, commands, tracker);
    session.enterMapViewMode('segment-b');

    tracker.currentWidget = { model: modelA };
    session['_onTrackerCurrentChanged']();

    expect(session.isActiveFor(modelA as never)).toBe(true);
    expect(barA.show).toHaveBeenCalled();
    expect(StoryMapInteractionBarWidget).toHaveBeenCalledTimes(2);
  });

  it('opens the dialog when exiting preview while another tab still previews', () => {
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

  it('opens the dialog for an orphan tab after session-owned preview exit', () => {
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
    session['_exitStoryPreviewForModel'](modelB);

    expect(StoryEditorWidget).toHaveBeenCalledWith(
      expect.objectContaining({ model: modelB }),
    );
  });
});
