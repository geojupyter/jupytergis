import {
  CommandIDs,
  GlobalStateDbManager,
  addCommands,
  createDefaultLayerRegistry,
} from '@jupytergis/base';
import {
  IJGISFormSchemaRegistry,
  IJGISFormSchemaRegistryToken,
  IJGISLayerBrowserRegistry,
  IJGISLayerBrowserRegistryToken,
  IJupyterGISDocTracker,
  IJupyterGISWidget,
} from '@jupytergis/schema';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';
import { WidgetTracker } from '@jupyterlab/apputils';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { ICompletionProviderManager } from '@jupyterlab/completer';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { IStateDB } from '@jupyterlab/statedb';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';

import { notebookRendererPlugin } from './notebookrenderer';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytergis:lab:main-menu',
  autoStart: true,
  requires: [
    IJupyterGISDocTracker,
    IJGISFormSchemaRegistryToken,
    IJGISLayerBrowserRegistryToken,
    IStateDB,
    IEditorServices,
    IRenderMimeRegistry,
  ],
  optional: [IMainMenu, ITranslator, ICompletionProviderManager],
  activate: (
    app: JupyterFrontEnd,
    tracker: WidgetTracker<IJupyterGISWidget>,
    formSchemaRegistry: IJGISFormSchemaRegistry,
    layerBrowserRegistry: IJGISLayerBrowserRegistry,
    state: IStateDB,
    editorServices: IEditorServices,
    rendermime: IRenderMimeRegistry,
    mainMenu?: IMainMenu,
    translator?: ITranslator,
    completionProviderManager?: ICompletionProviderManager,
  ): void => {
    console.debug('jupytergis:lab:main-menu is activated!');
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
      editorServices,
      rendermime,
      completionProviderManager,
    );


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

export default [plugin, notebookRendererPlugin];
