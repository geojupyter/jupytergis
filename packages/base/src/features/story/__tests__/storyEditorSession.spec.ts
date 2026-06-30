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

import { STORY_TYPE } from '@/src/types';
import { JupyterGISPanel } from '@/src/workspace/widget';
import { Widget } from '@lumino/widgets';
import { StoryEditorWidget } from '../storyEditorDialog';
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
    reject: jest.fn(),
    close: jest.fn(),
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

function createMainViewPanel(
  mainViewContainer: HTMLElement,
): InstanceType<typeof JupyterGISPanel> {
  const panel = new JupyterGISPanel();
  panel.jupyterGISMainViewPanel = {
    node: {
      querySelector: <T extends Element>(selector: string): T | null =>
        selector === '.jGIS-Mainview-Container'
          ? (mainViewContainer as T)
          : null,
    },
  } as never;
  return panel;
}

function createTracker(
  model: ReturnType<typeof createModel>,
  extraModels: ReturnType<typeof createModel>[] = [],
) {
  const widgets = [
    {
      model,
      content: createMainViewPanel(document.createElement('div')),
    },
    ...extraModels.map(extraModel => ({
      model: extraModel,
      content: createMainViewPanel(document.createElement('div')),
    })),
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
    find: jest.fn((predicate: (widget: (typeof widgets)[number]) => boolean) =>
      widgets.find(predicate),
    ),
    forEach: (fn: (widget: (typeof widgets)[number]) => void) => {
      for (const widget of widgets) {
        fn(widget);
      }
    },
    configureMainViewParents(
      resolver: (targetModel: typeof model) => HTMLElement,
    ): void {
      for (const widget of widgets) {
        widget.content = createMainViewPanel(resolver(widget.model));
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
  session.attachDialog(
    dialog as never,
    model as never,
    commands,
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

    expect(session.getMode(model as never)).toBe('inactive');
    expect(session.hasActiveInteraction()).toBe(false);
  });

  it('enters map view mode and applies the segment view', async () => {
    const dialog = createDialog();
    const model = createModel();
    const commands = createCommands();

    attachSession(session, dialog, model, commands);
    session.enterMapViewMode('segment-1');

    expect(session.getMode(model as never)).toBe('map-view');
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

    expect(session.getMode(model as never)).toBe('segment-preview');
    expect(applySegmentLayerOverrides).toHaveBeenCalledWith(
      model,
      'segment-2',
      [],
    );
    expect(dialog.close).toHaveBeenCalled();
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
    expect(session.hasActiveInteraction()).toBe(false);
  });

  it('keeps the session alive when the dialog closes during map interaction', () => {
    const dialog = createDialog();
    const model = createModel();
    const commands = createCommands();

    attachSession(session, dialog, model, commands);
    session.enterMapViewMode('segment-1');
    session.onDialogDisposed(model as never);

    expect(session.getMode(model as never)).toBe('map-view');
  });

  it('clears preview overrides when the dialog is dismissed', () => {
    const dialog = createDialog();
    const model = createModel();
    const commands = createCommands();

    attachSession(session, dialog, model, commands);
    session.enterPreviewMode('segment-3');
    session.clear();

    expect(clearSegmentLayerOverrideEntries).toHaveBeenCalledWith(model, []);
    expect(session.getMode(model as never)).toBe('inactive');
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

    expect(session.getMode(model as never)).toBe('story-preview');
    expect(model.setStoryPreviewActive).toHaveBeenCalledWith(true);
    expect(dialog.close).toHaveBeenCalled();
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
    expect(session.hasActiveInteraction()).toBe(false);
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
    session['onTrackerCurrentChanged']();
    expect(mapBar.hide).toHaveBeenCalled();
    expect(Widget.attach).not.toHaveBeenCalled();

    tracker.currentWidget = { model };
    session['onTrackerCurrentChanged']();

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
    const tracker = createTracker(modelB, [modelA]);
    const parentA = document.createElement('div');
    const parentB = document.createElement('div');

    attachSession(session, dialog, modelB, commands, tracker);
    session.enterStoryPreviewMode();

    tracker.configureMainViewParents(model =>
      model === modelA ? parentA : parentB,
    );

    tracker.currentWidget = { model: modelA };
    session['onTrackerCurrentChanged']();

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

    tracker.configureMainViewParents(model =>
      model === modelA ? parentA : parentB,
    );

    tracker.currentWidget = { model: modelB };
    session['onTrackerCurrentChanged']();
    session.exitStoryPreviewForModel(modelB);

    modelB.isStoryPreviewActive = jest.fn(() => false);
    mapBarA.show.mockClear();
    tracker.currentWidget = { model: modelA };
    session['onTrackerCurrentChanged']();

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

    expect(session.getMode(modelB as never)).toBe('inactive');
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

    tracker.configureMainViewParents(model =>
      model === modelA ? parentA : document.createElement('div'),
    );

    tracker.currentWidget = { model: modelB };
    session.restoreEditor();

    expect(StoryEditorWidget).toHaveBeenCalledWith(
      expect.objectContaining({ model: modelB }),
    );

    jest.mocked(StoryEditorWidget).mockClear();
    tracker.currentWidget = { model: modelA };
    session['onTrackerCurrentChanged']();
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

  it('closes the previous dialog when another model attaches', () => {
    const dialogA = createDialog();
    const dialogB = createDialog();
    const modelA = createModel({ filePath: 'a.jGIS' });
    const modelB = createModel({ filePath: 'b.jGIS' });
    const commands = createCommands();
    const tracker = createTracker(modelA, [modelB]);

    attachSession(session, dialogA, modelA, commands, tracker);
    expect(session.getMode(modelA as never)).toBe('editing');
    expect(session.getMode(modelB as never)).toBe('inactive');

    attachSession(session, dialogB, modelB, commands, tracker);
    expect(dialogA.close).toHaveBeenCalled();
    expect(session.getMode(modelA as never)).toBe('inactive');
    expect(session.getMode(modelB as never)).toBe('editing');
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
    session['onTrackerCurrentChanged']();

    expect(session.getMode(modelA as never)).not.toBe('inactive');
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
    session.exitStoryPreviewForModel(modelB);

    expect(StoryEditorWidget).toHaveBeenCalledWith(
      expect.objectContaining({ model: modelB }),
    );
  });
});
