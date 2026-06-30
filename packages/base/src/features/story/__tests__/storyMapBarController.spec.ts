/**
 * @jest-environment jsdom
 */

jest.mock('../components/StoryMapInteractionBarWidget', () => ({
  StoryMapInteractionBarWidget: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
    node: document.createElement('div'),
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

import { STORY_TYPE } from '@/src/types';
import { JupyterGISPanel } from '@/src/workspace/widget';
import { Widget } from '@lumino/widgets';
import { StoryMapInteractionBarWidget } from '../components/StoryMapInteractionBarWidget';
import {
  StoryMapBarController,
  type IStoryMapBarHost,
} from '../storyMapBarController';
import { SegmentInteractionMode } from '../types/types';

function createModel(overrides: Record<string, unknown> = {}) {
  return {
    isStoryPreviewActive: jest.fn(() => false),
    getSelectedStory: jest.fn(() => ({
      story: { storyType: STORY_TYPE.guided },
    })),
    ...overrides,
  };
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
  const parent = document.createElement('div');
  const widgets = [
    { model, content: createMainViewPanel(parent) },
    ...extraModels.map(extraModel => ({
      model: extraModel,
      content: createMainViewPanel(document.createElement('div')),
    })),
  ];

  return {
    currentWidget: { model },
    find: jest.fn((predicate: (widget: (typeof widgets)[number]) => boolean) =>
      widgets.find(predicate),
    ),
    forEach: (fn: (widget: (typeof widgets)[number]) => void) => {
      for (const widget of widgets) {
        fn(widget);
      }
    },
    parent,
  };
}

function createHost(
  tracker: ReturnType<typeof createTracker>,
  overrides: Partial<IStoryMapBarHost> = {},
): IStoryMapBarHost {
  return {
    getTracker: () => tracker as never,
    getInteraction: jest.fn(() => null),
    restoreEditorForModel: jest.fn(),
    applyMapViewForModel: jest.fn(),
    exitStoryPreviewForModel: jest.fn(),
    ...overrides,
  };
}

describe('StoryMapBarController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a bar for the current tab in map-view mode', () => {
    const model = createModel();
    const tracker = createTracker(model);
    const host = createHost(tracker, {
      getInteraction: jest.fn(() => ({
        mode: SegmentInteractionMode.mapView,
      })),
    });
    const controller = new StoryMapBarController(host);

    controller.refresh();

    expect(StoryMapInteractionBarWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Pan and zoom the map, then apply this view to the segment',
        placement: 'overlay-bottom',
      }),
    );
    expect(Widget.attach).toHaveBeenCalledWith(
      expect.objectContaining({ node: expect.any(HTMLElement) }),
      tracker.parent,
    );
  });

  it('hides the bar when the tab is not current', () => {
    const modelA = createModel({ filePath: 'a.jGIS' });
    const modelB = createModel({ filePath: 'b.jGIS' });
    const tracker = createTracker(modelB, [modelA]);
    const host = createHost(tracker, {
      getInteraction: jest.fn((model: ReturnType<typeof createModel>) =>
        model === modelA ? { mode: SegmentInteractionMode.mapView } : null,
      ),
    });
    const controller = new StoryMapBarController(host);

    controller.refresh();
    const bar = (StoryMapInteractionBarWidget as jest.Mock).mock.results[0]
      .value as { show: jest.Mock; hide: jest.Mock };
    bar.show.mockClear();

    tracker.currentWidget = { model: modelB };
    controller.refresh();

    expect(bar.hide).toHaveBeenCalled();
    expect(bar.show).not.toHaveBeenCalled();
  });

  it('disposes the bar when the model no longer needs one', () => {
    const model = createModel();
    const tracker = createTracker(model);
    const getInteraction = jest.fn(() => ({
      mode: SegmentInteractionMode.mapView,
    }));
    const host = createHost(tracker, { getInteraction });
    const controller = new StoryMapBarController(host);

    controller.refresh();
    const bar = (StoryMapInteractionBarWidget as jest.Mock).mock.results[0]
      .value as { dispose: jest.Mock };

    getInteraction.mockReturnValue(null);
    controller.refresh();

    expect(bar.dispose).toHaveBeenCalled();
    expect(StoryMapInteractionBarWidget).toHaveBeenCalledTimes(1);
  });

  it('uses main-top-left placement for guided story preview', () => {
    const model = createModel({
      isStoryPreviewActive: jest.fn(() => true),
      getSelectedStory: jest.fn(() => ({
        story: { storyType: STORY_TYPE.guided, title: 'Guided' },
      })),
    });
    const tracker = createTracker(model);
    const host = createHost(tracker);
    const controller = new StoryMapBarController(host);

    controller.refresh();

    expect(StoryMapInteractionBarWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Previewing "Guided"',
        placement: 'main-top-left',
      }),
    );
  });

  it('recreateBarForModel disposes then refreshes bars for the model', () => {
    const model = createModel({
      isStoryPreviewActive: jest.fn(() => true),
    });
    const tracker = createTracker(model);
    const host = createHost(tracker);
    const controller = new StoryMapBarController(host);

    controller.refresh();
    const disposeSpy = jest.spyOn(controller, 'disposeForModel');
    const refreshSpy = jest.spyOn(controller, 'refresh');
    disposeSpy.mockClear();
    refreshSpy.mockClear();

    controller.recreateBarForModel(model as never);

    expect(disposeSpy).toHaveBeenCalledWith(model);
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('routes map-view bar actions through the host', () => {
    const model = createModel();
    const tracker = createTracker(model);
    const host = createHost(tracker, {
      getInteraction: jest.fn(() => ({
        mode: SegmentInteractionMode.mapView,
      })),
    });
    const controller = new StoryMapBarController(host);

    controller.refresh();

    const config = (StoryMapInteractionBarWidget as jest.Mock).mock.calls[0][0];
    config.children.props.onBack();
    config.children.props.onApply();

    expect(host.restoreEditorForModel).toHaveBeenCalledWith(model);
    expect(host.applyMapViewForModel).toHaveBeenCalledWith(model);
  });

  it('routes story preview back through the host', () => {
    const model = createModel({
      isStoryPreviewActive: jest.fn(() => true),
    });
    const tracker = createTracker(model);
    const host = createHost(tracker);
    const controller = new StoryMapBarController(host);

    controller.refresh();

    const config = (StoryMapInteractionBarWidget as jest.Mock).mock.calls[0][0];
    config.children.props.onBack();

    expect(host.exitStoryPreviewForModel).toHaveBeenCalledWith(model);
  });
});
