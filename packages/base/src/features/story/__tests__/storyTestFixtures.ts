import { jest } from '@jest/globals';

import { STORY_TYPE } from '@/src/types';
import { JupyterGISPanel } from '@/src/workspace/widget';
import type { StoryEditorSession } from '../storyEditorSession';

export function createMainViewPanel(
  mainViewContainer: HTMLElement,
): InstanceType<typeof JupyterGISPanel> {
  const panel = Object.create(JupyterGISPanel.prototype) as InstanceType<
    typeof JupyterGISPanel
  >;

  Object.assign(panel, {
    jupyterGISMainViewPanel: {
      node: {
        querySelector: <T extends Element>(selector: string): T | null =>
          selector === '.jGIS-Mainview-Container'
            ? (mainViewContainer as unknown as T)
            : null,
      },
    },
  });

  return panel;
}

export function createDialog() {
  return {
    close: jest.fn(),
    launch: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
    show: jest.fn(),
    hide: jest.fn(),
    activate: jest.fn(),
    dispose: jest.fn(),
  };
}

export function createModel(overrides: Record<string, unknown> = {}) {
  let storyPreviewActive = false;
  let uiState = { leftPanelOpen: true, rightPanelOpen: true };

  return {
    centerOnPosition: jest.fn(),
    canUseStoryPreview: jest.fn(() => true),
    isStoryPreviewActive: jest.fn(() => storyPreviewActive),
    setStoryPreviewActive: jest.fn((active: boolean) => {
      storyPreviewActive = active;
    }),
    storyPreviewActiveChanged: {
      connect: jest.fn(),
      disconnect: jest.fn(),
    },
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

export function createCommands() {
  return {
    execute: jest.fn(),
    isToggled: jest.fn(() => false),
    notifyCommandChanged: jest.fn(),
  } as unknown as import('@lumino/commands').CommandRegistry;
}
export function createTracker(
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

  return {
    currentWidget: { model },
    currentChanged: {
      connect: jest.fn(),
      disconnect: jest.fn(),
    },
    widgetAdded: {
      connect: jest.fn(),
      disconnect: jest.fn(),
    },
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
    setActiveModel(targetModel: typeof model): void {
      this.currentWidget = { model: targetModel };
    },
    [Symbol.iterator]: function* () {
      for (const widget of widgets) {
        yield widget;
      }
    },
  };
}

/** Attaches a mock dialog without launching (test shortcut for the editing state). */
export function attachSession(
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
    {} as never,
  );
  return tracker;
}

export function notifyTrackerTabChange(session: StoryEditorSession): void {
  session['onTrackerCurrentChanged']();
}
