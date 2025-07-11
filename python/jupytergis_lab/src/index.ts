import {
  CommandIDs,
  GlobalStateDbManager,
  addCommands,
  createDefaultLayerRegistry,
  rasterSubMenu,
  vectorSubMenu,
} from '@jupytergis/base';
import {
  IJGISFormSchemaRegistry,
  IJGISFormSchemaRegistryToken,
  IJGISLayerBrowserRegistry,
  IJGISLayerBrowserRegistryToken,
  IJGISLayerItem,
  IJupyterGISDocTracker,
  IJupyterGISWidget,
  ProcessingMerge,
} from '@jupytergis/schema';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';
import { WidgetTracker } from '@jupyterlab/apputils';
import { ICompletionProviderManager } from '@jupyterlab/completer';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { IStateDB } from '@jupyterlab/statedb';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { ContextMenu, Menu } from '@lumino/widgets';

import { notebookRendererPlugin } from './notebookrenderer';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytergis:lab:main-menu',
  autoStart: true,
  requires: [
    IJupyterGISDocTracker,
    IJGISFormSchemaRegistryToken,
    IJGISLayerBrowserRegistryToken,
    IStateDB,
  ],
  optional: [IMainMenu, ITranslator, ICompletionProviderManager],
  activate: (
    app: JupyterFrontEnd,
    tracker: WidgetTracker<IJupyterGISWidget>,
    formSchemaRegistry: IJGISFormSchemaRegistry,
    layerBrowserRegistry: IJGISLayerBrowserRegistry,
    state: IStateDB,
    mainMenu?: IMainMenu,
    translator?: ITranslator,
    completionProviderManager?: ICompletionProviderManager,
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
    const stateDbManager = GlobalStateDbManager.getInstance();
    stateDbManager.initialize(state);

    addCommands(
      app,
      tracker,
      translator,
      formSchemaRegistry,
      layerBrowserRegistry,
      state,
      completionProviderManager,
    );

    app.contextMenu.addItem({
      selector: '.jp-gis-source.jp-gis-sourceUnused',
      rank: 1,
      command: CommandIDs.removeSource,
    });

    app.contextMenu.addItem({
      selector: '.jp-gis-source',
      rank: 1,
      command: CommandIDs.renameSource,
    });

    // LAYERS and LAYER GROUPS context menu
    app.contextMenu.addItem({
      command: CommandIDs.symbology,
      selector: '.jp-gis-layerItem',
      rank: 1,
    });

    // Separator
    app.contextMenu.addItem({
      type: 'separator',
      selector: '.jp-gis-layerPanel',
      rank: 1,
    });

    app.contextMenu.addItem({
      command: CommandIDs.removeLayer,
      selector: '.jp-gis-layerItem',
      rank: 2,
    });

    app.contextMenu.addItem({
      command: CommandIDs.renameLayer,
      selector: '.jp-gis-layerItem',
      rank: 2,
    });

    app.contextMenu.addItem({
      command: CommandIDs.zoomToLayer,
      selector: '.jp-gis-layerItem',
      rank: 2,
    });

    // Create the Download submenu
    const downloadSubmenu = new Menu({ commands: app.commands });
    downloadSubmenu.title.label = translator.load('jupyterlab').__('Download');
    downloadSubmenu.id = 'jp-gis-contextmenu-download';

    downloadSubmenu.addItem({
      command: CommandIDs.downloadGeoJSON,
    });

    // Add the Download submenu to the context menu
    app.contextMenu.addItem({
      type: 'submenu',
      selector: '.jp-gis-layerItem',
      rank: 2,
      submenu: downloadSubmenu,
    });

    // Create the Processing submenu
    const processingSubmenu = new Menu({ commands: app.commands });
    processingSubmenu.title.label = translator
      .load('jupyterlab')
      .__('Processing');
    processingSubmenu.id = 'jp-gis-contextmenu-processing';

    for (const processingElement of ProcessingMerge) {
      processingSubmenu.addItem({
        command: processingElement.name,
      });
    }

    app.contextMenu.addItem({
      type: 'submenu',
      selector: '.jp-gis-layerItem',
      rank: 2,
      submenu: processingSubmenu,
    });

    const moveLayerSubmenu = new Menu({ commands: app.commands });
    moveLayerSubmenu.title.label = translator
      .load('jupyterlab')
      .__('Move Selected Layers to Group');
    moveLayerSubmenu.id = 'jp-gis-contextmenu-movelayer';

    app.contextMenu.addItem({
      type: 'submenu',
      selector: '.jp-gis-layerItem',
      rank: 2,
      submenu: moveLayerSubmenu,
    });

    app.contextMenu.opened.connect(() =>
      buildGroupsMenu(app.contextMenu, tracker),
    );

    app.contextMenu.addItem({
      command: CommandIDs.removeGroup,
      selector: '.jp-gis-layerGroupHeader',
      rank: 2,
    });

    app.contextMenu.addItem({
      command: CommandIDs.renameGroup,
      selector: '.jp-gis-layerGroupHeader',
      rank: 2,
    });

    // Separator
    app.contextMenu.addItem({
      type: 'separator',
      selector: '.jp-gis-layerPanel',
      rank: 2,
    });

    const newLayerSubMenu = new Menu({ commands: app.commands });
    newLayerSubMenu.title.label = translator.load('jupyterlab').__('Add Layer');
    newLayerSubMenu.id = 'jp-gis-contextmenu-addLayer';

    newLayerSubMenu.addItem({
      type: 'submenu',
      submenu: rasterSubMenu(app.commands),
    });
    newLayerSubMenu.addItem({
      type: 'submenu',
      submenu: vectorSubMenu(app.commands),
    });

    app.contextMenu.addItem({
      type: 'submenu',
      selector: '.jp-gis-layerPanel',
      rank: 3,
      submenu: newLayerSubMenu,
    });

    if (mainMenu) {
      populateMenus(mainMenu, isEnabled);
    }
  },
};

/**
 * Populates the application menus for the notebook.
 */
function populateMenus(mainMenu: IMainMenu, isEnabled: () => boolean): void {
  // Add undo/redo hooks to the edit menu.
  mainMenu.editMenu.undoers.redo.add({
    id: CommandIDs.redo,
    isEnabled,
  });
  mainMenu.editMenu.undoers.undo.add({
    id: CommandIDs.undo,
    isEnabled,
  });
}

/**
 * Populate submenu with current group names
 */
function buildGroupsMenu(
  contextMenu: ContextMenu,
  tracker: WidgetTracker<IJupyterGISWidget>,
) {
  if (!tracker.currentWidget?.model) {
    return;
  }

  const model = tracker.currentWidget?.model;

  const submenu =
    contextMenu.menu.items.find(
      item =>
        item.type === 'submenu' &&
        item.submenu?.id === 'jp-gis-contextmenu-movelayer',
    )?.submenu ?? null;

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
    args: { label: '' },
  });

  groupNames.forEach(name => {
    submenu.addItem({
      command: CommandIDs.moveLayersToGroup,
      args: { label: name },
    });
  });

  submenu.addItem({
    command: CommandIDs.moveLayerToNewGroup,
  });
}

export default [plugin, notebookRendererPlugin];
