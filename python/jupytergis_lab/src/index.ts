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
  IJGISLayerItem,
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

import { ContextMenu, Menu } from '@lumino/widgets';
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

    app.contextMenu.addItem({
      command: CommandIDs.removeLayer,
      selector: '.jp-gis-layerTitle',
      rank: 1
    });

    app.contextMenu.addItem({
      command: CommandIDs.renameLayer,
      selector: '.jp-gis-layerTitle',
      rank: 1
    });

    const submenu = new Menu({ commands: app.commands });
    submenu.title.label = translator
      .load('jupyterlab')
      .__('Move Layers to Group');

    app.contextMenu.addItem({
      type: 'submenu',
      selector: '.jp-gis-layerTitle',
      rank: 2,
      submenu
    });

    app.contextMenu.opened.connect(() =>
      buildGroupsMenu(app.contextMenu, tracker)
    );

    app.contextMenu.addItem({
      type: 'separator',
      selector: '.jp-gis-layerGroupHeader',
      rank: 1
    });

    app.contextMenu.addItem({
      command: CommandIDs.removeGroup,
      selector: '.jp-gis-layerGroupHeader',
      rank: 1
    });

    app.contextMenu.addItem({
      command: CommandIDs.renameGroup,
      selector: '.jp-gis-layerGroupHeader',
      rank: 1
    });

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

/**
 * Populate submenu with current group names
 */
function buildGroupsMenu(
  contextMenu: ContextMenu,
  tracker: WidgetTracker<JupyterGISWidget>
) {
  if (!tracker.currentWidget?.context.model) {
    return;
  }

  const model = tracker.currentWidget?.context.model;

  const submenu =
    contextMenu.menu.items.find(item => item.type === 'submenu')?.submenu ??
    null;

  // Bail early if the submenu isn't found
  if (!submenu) {
    return;
  }

  submenu.clearItems();

  // need a list of group name
  const layerTree = model.getLayerTree();
  const groupNames = getLayerGroupNames(layerTree);

  function getLayerGroupNames(layerTree: IJGISLayerItem[]): string[] {
    const result: string[] = [];

    for (const item of layerTree) {
      // Skip if the item is a layer id
      if (typeof item === 'string') {
        continue;
      }

      // Process group items
      if (item.layers) {
        result.push(item.name);

        // Recursively process the layers of the current item
        const nestedResults = getLayerGroupNames(item.layers);
        // Append the results of the recursive call to the main result array
        result.push(...nestedResults);
      }
    }

    return result;
  }

  submenu.addItem({
    command: CommandIDs.moveLayersToGroup,
    args: { label: '' }
  });

  groupNames.forEach(name => {
    submenu.addItem({
      command: CommandIDs.moveLayersToGroup,
      args: { label: name }
    });
  });

  submenu.addItem({
    command: CommandIDs.moveLayerToNewGroup
  });
}

export default [plugin, controlPanel, notebookRenderePlugin];
