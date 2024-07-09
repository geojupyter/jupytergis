import {
  CommandIDs,
  ControlPanelModel,
  JupyterGISWidget,
  LeftPanelWidget,
  RightPanelWidget,
  addCommands,
  createDefaultLayerRegistry
} from '@jupytergis/base';
import {
  IJGISFormSchemaRegistry,
  IJGISFormSchemaRegistryToken,
  IJGISLayerBrowserRegistry,
  IJGISLayerBrowserRegistryToken,
  IJupyterGISDocTracker,
  IJupyterGISTracker
} from '@jupytergis/schema';
import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { WidgetTracker } from '@jupyterlab/apputils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';

import { notebookRenderePlugin } from './notebookrenderer';

const NAME_SPACE = 'jupytergis';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytergis:lab:main-menu',
  autoStart: true,
  requires: [
    IJupyterGISDocTracker,
    IJGISFormSchemaRegistryToken,
    IJGISLayerBrowserRegistryToken
  ],
  optional: [IMainMenu, ITranslator],
  activate: (
    app: JupyterFrontEnd,
    tracker: WidgetTracker<JupyterGISWidget>,
    formSchemaRegistry: IJGISFormSchemaRegistry,
    layerBrowserRegistry: IJGISLayerBrowserRegistry,
    mainMenu?: IMainMenu,
    translator?: ITranslator
  ): void => {
    console.log('jupytergis:lab:main-menu is activated!');
    translator = translator ?? nullTranslator;
    const isEnabled = (): boolean => {
      return (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      );
    };

    createDefaultLayerRegistry(layerBrowserRegistry);

    addCommands(
      app,
      tracker,
      translator,
      formSchemaRegistry,
      layerBrowserRegistry
    );

    if (mainMenu) {
      populateMenus(mainMenu, isEnabled);
    }
  }
};

const controlPanel: JupyterFrontEndPlugin<void> = {
  id: 'jupytergis:lab:controlpanel',
  autoStart: true,
  requires: [
    ILayoutRestorer,
    IJupyterGISDocTracker,
    IJGISFormSchemaRegistryToken
  ],
  activate: (
    app: JupyterFrontEnd,
    restorer: ILayoutRestorer,
    tracker: IJupyterGISTracker,
    formSchemaRegistry: IJGISFormSchemaRegistry
  ) => {
    const controlModel = new ControlPanelModel({ tracker });

    const leftControlPanel = new LeftPanelWidget({
      model: controlModel,
      tracker
    });
    leftControlPanel.id = 'jupytergis::leftControlPanel';
    leftControlPanel.title.caption = 'JupyterGIS Control Panel';
    // TODO Need an icon
    // leftControlPanel.title.icon = jcLightIcon;

    const rightControlPanel = new RightPanelWidget({
      model: controlModel,
      tracker,
      formSchemaRegistry
    });
    rightControlPanel.id = 'jupytergis::rightControlPanel';
    rightControlPanel.title.caption = 'JupyterGIS Control Panel';
    // TODO Need an icon
    // rightControlPanel.title.icon = jcLightIcon;

    if (restorer) {
      restorer.add(leftControlPanel, NAME_SPACE);
      restorer.add(rightControlPanel, NAME_SPACE);
    }
    app.shell.add(leftControlPanel, 'left', { rank: 2000 });
    app.shell.add(rightControlPanel, 'right', { rank: 2000 });
  }
};

/**
 * Populates the application menus for the notebook.
 */
function populateMenus(mainMenu: IMainMenu, isEnabled: () => boolean): void {
  // Add undo/redo hooks to the edit menu.
  mainMenu.editMenu.undoers.redo.add({
    id: CommandIDs.redo,
    isEnabled
  });
  mainMenu.editMenu.undoers.undo.add({
    id: CommandIDs.undo,
    isEnabled
  });
}

export default [plugin, controlPanel, notebookRenderePlugin];
