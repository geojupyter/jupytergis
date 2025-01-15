import {
  CommandIDs,
  ControlPanelModel,
  GlobalStateDbManager,
  JupyterGISWidget,
  LeftPanelWidget,
  RightPanelWidget,
  addCommands,
  createDefaultLayerRegistry,
  logoMiniIcon
} from '@jupytergis/base';
import {
  IAnnotationModel,
  IAnnotationToken,
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
import { ICompletionProviderManager } from '@jupyterlab/completer';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { IStateDB } from '@jupyterlab/statedb';
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
    IJGISLayerBrowserRegistryToken,
    IStateDB
  ],
  optional: [IMainMenu, ITranslator, ICompletionProviderManager],
  activate: (
    app: JupyterFrontEnd,
    tracker: WidgetTracker<JupyterGISWidget>,
    formSchemaRegistry: IJGISFormSchemaRegistry,
    layerBrowserRegistry: IJGISLayerBrowserRegistry,
    state: IStateDB,
    mainMenu?: IMainMenu,
    translator?: ITranslator,
    completionProviderManager?: ICompletionProviderManager
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
      completionProviderManager
    );

    app.shell.addClass('data-jgis-keybinding');

    // SOURCES context menu
    const newSourceSubMenu = new Menu({ commands: app.commands });
    newSourceSubMenu.title.label = translator
      .load('jupyterlab')
      .__('Add Source');
    newSourceSubMenu.id = 'jp-gis-contextmenu-addSource';

    app.contextMenu.addItem({
      type: 'submenu',
      selector: '.jp-gis-sourcePanel',
      rank: 3,
      submenu: newSourceSubMenu
    });

    newSourceSubMenu.addItem({
      command: CommandIDs.newRasterSource,
      args: { from: 'contextMenu' }
    });

    newSourceSubMenu.addItem({
      command: CommandIDs.newVectorSource,
      args: { from: 'contextMenu' }
    });

    newSourceSubMenu.addItem({
      command: CommandIDs.newGeoJSONSource,
      args: { from: 'contextMenu' }
    });

    newSourceSubMenu.addItem({
      command: CommandIDs.newRasterDemSource,
      args: { from: 'contextMenu' }
    });

    newSourceSubMenu.addItem({
      command: CommandIDs.newImageSource,
      args: { from: 'contextMenu' }
    });

    app.contextMenu.addItem({
      type: 'separator',
      selector: '.jp-gis-sourcePanel',
      rank: 2
    });

    app.contextMenu.addItem({
      selector: '.jp-gis-source.jp-gis-sourceUnused',
      rank: 1,
      command: CommandIDs.removeSource
    });

    app.contextMenu.addItem({
      selector: '.jp-gis-source',
      rank: 1,
      command: CommandIDs.renameSource
    });

    // LAYERS and LAYER GROUPS context menu
    app.contextMenu.addItem({
      command: CommandIDs.symbology,
      selector: '.jp-gis-layerItem',
      rank: 1
    });

    // Separator
    app.contextMenu.addItem({
      type: 'separator',
      selector: '.jp-gis-layerPanel',
      rank: 1
    });

    app.contextMenu.addItem({
      command: CommandIDs.removeLayer,
      selector: '.jp-gis-layerItem',
      rank: 2
    });

    app.contextMenu.addItem({
      command: CommandIDs.renameLayer,
      selector: '.jp-gis-layerItem',
      rank: 2
    });

    app.contextMenu.addItem({
      command: CommandIDs.zoomToLayer,
      selector: '.jp-gis-layerItem',
      rank: 2
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
      submenu: moveLayerSubmenu
    });

    app.contextMenu.opened.connect(() =>
      buildGroupsMenu(app.contextMenu, tracker)
    );

    app.contextMenu.addItem({
      command: CommandIDs.removeGroup,
      selector: '.jp-gis-layerGroupHeader',
      rank: 2
    });

    app.contextMenu.addItem({
      command: CommandIDs.renameGroup,
      selector: '.jp-gis-layerGroupHeader',
      rank: 2
    });

    // Separator
    app.contextMenu.addItem({
      type: 'separator',
      selector: '.jp-gis-layerPanel',
      rank: 2
    });

    const newLayerSubMenu = new Menu({ commands: app.commands });
    newLayerSubMenu.title.label = translator.load('jupyterlab').__('Add Layer');
    newLayerSubMenu.id = 'jp-gis-contextmenu-addLayer';

    app.contextMenu.addItem({
      type: 'submenu',
      selector: '.jp-gis-layerPanel',
      rank: 3,
      submenu: newLayerSubMenu
    });

    newLayerSubMenu.addItem({
      command: CommandIDs.newRasterLayer,
      args: { from: 'contextMenu' }
    });

    newLayerSubMenu.addItem({
      command: CommandIDs.newVectorLayer,
      args: { from: 'contextMenu' }
    });

    newLayerSubMenu.addItem({
      command: CommandIDs.newHillshadeLayer,
      args: { from: 'contextMenu' }
    });

    newLayerSubMenu.addItem({
      command: CommandIDs.newImageLayer,
      args: { from: 'contextMenu' }
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
    IJGISFormSchemaRegistryToken,
    IStateDB,
    IAnnotationToken
  ],
  activate: (
    app: JupyterFrontEnd,
    restorer: ILayoutRestorer,
    tracker: IJupyterGISTracker,
    formSchemaRegistry: IJGISFormSchemaRegistry,
    state: IStateDB,
    annotationModel: IAnnotationModel
  ) => {
    const controlModel = new ControlPanelModel({ tracker });

    const leftControlPanel = new LeftPanelWidget({
      model: controlModel,
      tracker,
      state
    });
    leftControlPanel.id = 'jupytergis::leftControlPanel';
    leftControlPanel.title.caption = 'JupyterGIS Control Panel';
    leftControlPanel.title.icon = logoMiniIcon;

    const rightControlPanel = new RightPanelWidget({
      model: controlModel,
      tracker,
      formSchemaRegistry,
      annotationModel
    });
    rightControlPanel.id = 'jupytergis::rightControlPanel';
    rightControlPanel.title.caption = 'JupyterGIS Control Panel';
    rightControlPanel.title.icon = logoMiniIcon;

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
    contextMenu.menu.items.find(
      item =>
        item.type === 'submenu' &&
        item.submenu?.id === 'jp-gis-contextmenu-movelayer'
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
