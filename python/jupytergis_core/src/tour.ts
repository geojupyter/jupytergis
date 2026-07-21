import { CommandIDs } from '@jupytergis/base';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';
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

/**
 * Every step anchors to persistent JupyterGIS chrome (toolbar buttons and the
 * layers panel) rather than opening modal dialogs. Modal Lumino dialogs render
 * a blocking backdrop that hides the tour tooltip and swallows its "Next"
 * click, so the tour describes how to reach those dialogs instead of opening
 * them.
 */
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
          'This quick tour walks you through the main JupyterGIS building blocks: adding layers, editing their properties and symbology, and building story maps.',
        ),
        placement: 'center',
        disableBeacon: true,
      },
      {
        target: `[data-command="${CommandIDs.openLayerBrowser}"]`,
        title: trans.__('Add a basemap'),
        content: trans.__(
          'Open the layer browser to pick a basemap or one of the curated data sources to start your map.',
        ),
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '[data-testid="new-entry-button"]',
        title: trans.__('Add layers'),
        content: trans.__(
          'Use the Add Layer button to create raster or vector layers from your own sources, such as a GeoJSON file or a remote URL.',
        ),
        placement: 'bottom',
      },
      {
        target: '.jp-gis-layerPanel',
        title: trans.__('Layers panel'),
        content: trans.__(
          'The Layers panel shows your layer stack. Select a layer, reorder it, or toggle its visibility. Right-click a layer to reach more actions.',
        ),
        placement: 'right',
      },
      {
        target: '.jp-gis-layerItem:not(.jp-gis-layerGroup)',
        title: trans.__('Edit a layer'),
        content: trans.__(
          'Right-click a layer to reach its actions: choose "Edit" to change its properties and source through schema-driven forms, or "Edit Symbology" to configure the colors, ramps, and rules used to render it.',
        ),
        placement: 'top',
      },
      {
        target: '[data-testid="open-story-editor-button"]',
        title: trans.__('Create a story map'),
        content: trans.__(
          'Open the Story Editor to turn map views and narrative content into a guided story experience made of ordered segments.',
        ),
        placement: 'bottom',
      },
    ],
  };
}

async function registerAndLaunchTour(
  app: JupyterFrontEnd,
  translator: ITranslator,
): Promise<void> {
  if (!app.commands.hasCommand(TOUR_ADD_COMMAND)) {
    console.warn(
      'jupyterlab-tour is not installed; JupyterGIS tour is disabled.',
    );
    return;
  }

  const tourDef = createJupyterGISTour(translator);

  await app.commands.execute(TOUR_ADD_COMMAND, {
    tour: tourDef as any,
  });

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
    const trans = actualTranslator.load('jupyterlab');

    app.commands.addCommand(CommandIDs.launchFeatureTour, {
      label: trans.__('Start JupyterGIS Feature Tour'),
      caption: trans.__(
        'Launch the guided tour for core JupyterGIS workflows.',
      ),
      execute: async () => {
        await registerAndLaunchTour(app, actualTranslator);
      },
    });

    palette?.addItem({
      command: CommandIDs.launchFeatureTour,
      category: 'JupyterGIS',
    });
  },
};

export default tourPlugin;
