import { CommandIDs } from '@jupytergis/base';
import { IJupyterGISWidget } from '@jupytergis/schema';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';
import { ICommandPalette, WidgetTracker } from '@jupyterlab/apputils';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';

const TOUR_ADD_COMMAND = 'jupyterlab-tour:add';
const TOUR_LAUNCH_COMMAND = 'jupyterlab-tour:launch';
const JUPYTERGIS_TOUR_ID = 'jupytergis:feature-tour';

interface ITourStep {
  target: string;
  title?: string;
  content: string;
  placement?:
    | 'auto'
    | 'center'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top-start'
    | 'top-end'
    | 'bottom-start'
    | 'bottom-end'
    | 'left-start'
    | 'left-end'
    | 'right-start'
    | 'right-end';
  disableBeacon?: boolean;
  spotlightClicks?: boolean;
}

interface ITourDefinition {
  id: string;
  label: string;
  hasHelpEntry?: boolean;
  steps: ITourStep[];
  options?: {
    showProgress?: boolean;
    continuous?: boolean;
    scrollToFirstStep?: boolean;
  };
}

interface ITourCallbackData {
  type?: string;
  index?: number;
}

interface ITourHandler {
  stepChanged: {
    connect: (
      slot: (_sender: unknown, data: ITourCallbackData) => void,
    ) => void;
  };
}

function createJupyterGISTour(translator: ITranslator): ITourDefinition {
  const trans = translator.load('jupyterlab');

  return {
    id: JUPYTERGIS_TOUR_ID,
    label: trans.__('JupyterGIS Feature Tour'),
    hasHelpEntry: true,
    options: {
      showProgress: true,
      continuous: true,
      scrollToFirstStep: true,
    },
    steps: [
      {
        target: '#jp-main-dock-panel',
        title: trans.__('Welcome to the JupyterGIS Feature Tour'),
        content: trans.__(
          'The tour will guide you through using JupyterGIS.',
        ),
        placement: 'center',
        disableBeacon: true,
      },
      {
        target: `[data-command="${CommandIDs.openLayerBrowser}"]`,
        title: trans.__("Adding a basemap."),
        content: trans.__(
          "Let's start by selecting a basemap from our layer gallery",
        ),
        disableBeacon: true,
      },
      // {
      //   target: '[data-testid="new-entry-button"]',
      //   title: trans.__('Add Layers'),
      //   content: trans.__(
      //     'Use this Add Layer button to open the layer menu and create raster or vector layers in your map.',
      //   ),
      //   placement: 'bottom',
      // },
      // {
      //   target: '.jGIS-layer-CreationFormDialog',
      //   title: trans.__('Create a Layer Document Entry'),
      //   content: trans.__(
      //     'This dialog lets you define a new source and layer. Fill in source parameters and confirm to add it to your project.',
      //   ),
      //   placement: 'left',
      // },
      // {
      //   target: '[data-testid="open-layers-browser"]',
      //   title: trans.__('Layer Browser'),
      //   content: trans.__(
      //     'Open the layer browser to discover additional data sources and curated examples.',
      //   ),
      //   placement: 'bottom',
      // },
      // {
      //   target: '.jp-gis-layerPanel',
      //   title: trans.__('Layers Panel'),
      //   content: trans.__(
      //     'The Layers panel shows your layer stack. Select a layer, reorder it, toggle visibility, or right-click for actions.',
      //   ),
      //   placement: 'right',
      // },
      // {
      //   target: '.jp-gis-layerItem:not(.jp-gis-layerGroup)',
      //   title: trans.__('Edit Layer Properties'),
      //   content: trans.__(
      //     'Select a layer and use context menu actions to edit layer properties, rename it, duplicate it, or zoom to it.',
      //   ),
      //   placement: 'right',
      // },
      // {
      //   target: '.jp-gis-object-properties-dialog',
      //   title: trans.__('Object and Layer Properties'),
      //   content: trans.__(
      //     'This properties dialog lets you edit the selected layer or source details with schema-driven forms.',
      //   ),
      //   placement: 'left',
      // },
      // {
      //   target: '.jp-gis-symbology-dialog',
      //   title: trans.__('Edit Symbology'),
      //   content: trans.__(
      //     'Use the symbology editor to configure colors, ramps, and rules for how your selected layer is rendered.',
      //   ),
      //   placement: 'left',
      // },
      // {
      //   target: '[data-testid="open-story-editor-button"]',
      //   title: trans.__('Create a Story Map'),
      //   content: trans.__(
      //     'Open the Story Editor to turn map views and narrative content into a story experience.',
      //   ),
      //   placement: 'bottom',
      // },
      // {
      //   target: '.jgis-story-editor-dialog',
      //   title: trans.__('Story Editor'),
      //   content: trans.__(
      //     'In Story Editor, create and organize segments, then configure map view, content, and transitions for each segment.',
      //   ),
      //   placement: 'left',
      // },
      // {
      //   target: '.jgis-story-editor-segment-list',
      //   title: trans.__('Story Segments'),
      //   content: trans.__(
      //     'Add, select, and reorder segments here. Each segment can be map-focused or text-focused depending on your narrative.',
      //   ),
      //   placement: 'right',
      // },
    ],
  };
}

function wireTourStepActions(
  app: JupyterFrontEnd,
  tour: ITourHandler | null,
): void {
  if (!tour) {
    return;
  }

  tour.stepChanged.connect((_sender, data) => {
    if (data.type !== 'step:before') {
      return;
    }

    switch (data.index) {
      case 1:
        void app.commands.execute(CommandIDs.createNew);
        break;
      case 3:
        void app.commands.execute(CommandIDs.openNewGeoJSONDialog);
        break;
      case 5:
      case 6:
        void app.commands.execute(CommandIDs.showLayersTab);
        break;
      case 7:
        void app.commands.execute(CommandIDs.showLayerPropertiesDialog);
        break;
      case 8:
        void app.commands.execute(CommandIDs.symbology);
        break;
      case 10:
        void app.commands.execute(CommandIDs.openStoryEditor);
        break;
      default:
        break;
    }
  });
}

async function registerAndLaunchTour(
  app: JupyterFrontEnd,
  translator: ITranslator,
): Promise<void> {
  if (!app.commands.hasCommand(TOUR_ADD_COMMAND)) {
    console.info('jupyterlab-tour is not installed; JupyterGIS tour is disabled.');
    return;
  }

  const tourDef = createJupyterGISTour(translator);

  const tour = (await app.commands.execute(TOUR_ADD_COMMAND, {
    tour: tourDef as any,
  })) as ITourHandler | null;

  wireTourStepActions(app, tour);

  if (app.commands.hasCommand(TOUR_LAUNCH_COMMAND)) {
    await app.commands.execute(TOUR_LAUNCH_COMMAND, {
      id: JUPYTERGIS_TOUR_ID,
      force: true,
    });
  }
}

const tourPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytergis:lab:tour',
  autoStart: true,
  optional: [ICommandPalette, ITranslator],
  activate: (
    app: JupyterFrontEnd,
    palette?: ICommandPalette,
    translator?: ITranslator,
  ) => {
    const actualTranslator = translator ?? nullTranslator;

    app.commands.addCommand(CommandIDs.launchFeatureTour, {
      label: actualTranslator
        .load('jupyterlab')
        .__('Start JupyterGIS Feature Tour'),
      caption: actualTranslator
        .load('jupyterlab')
        .__('Launch the guided tour for core JupyterGIS workflows.'),
      execute: async () => {
        await registerAndLaunchTour(app, actualTranslator);
      },
    });

    // Layers and Sources
    palette?.addItem({
      command: CommandIDs.launchFeatureTour,
      category: 'JupyterGIS',
    });
  },
};

export default tourPlugin;
