import {
  ControlPanelModel,
  jcLightIcon,
  JupyterCadWidget,
  LeftPanelWidget,
  RightPanelWidget,
  addCommands,
  CommandIDs
} from '@jupytergis/base';
import {
  IAnnotationModel,
  IAnnotationToken,
  IJCadFormSchemaRegistry,
  IJCadFormSchemaRegistryToken,
  IJCadWorkerRegistry,
  IJCadWorkerRegistryToken,
  IJupyterCadDocTracker,
  IJupyterCadTracker
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

const NAME_SPACE = 'jupytercad';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytercad:lab:main-menu',
  autoStart: true,
  requires: [
    IJupyterCadDocTracker,
    IJCadFormSchemaRegistryToken,
    IJCadWorkerRegistryToken
  ],
  optional: [IMainMenu, ITranslator],
  activate: (
    app: JupyterFrontEnd,
    tracker: WidgetTracker<JupyterCadWidget>,
    formSchemaRegistry: IJCadFormSchemaRegistry,
    workerRegistry: IJCadWorkerRegistry,
    mainMenu?: IMainMenu,
    translator?: ITranslator
  ): void => {
    console.log('jupytercad:lab:main-menu is activated!');
    translator = translator ?? nullTranslator;
    const isEnabled = (): boolean => {
      return (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      );
    };

    addCommands(app, tracker, translator, formSchemaRegistry, workerRegistry);
    if (mainMenu) {
      populateMenus(mainMenu, isEnabled);
    }
  }
};

const controlPanel: JupyterFrontEndPlugin<void> = {
  id: 'jupytercad:lab:controlpanel',
  autoStart: true,
  requires: [
    ILayoutRestorer,
    IJupyterCadDocTracker,
    IAnnotationToken,
    IJCadFormSchemaRegistryToken
  ],
  activate: (
    app: JupyterFrontEnd,
    restorer: ILayoutRestorer,
    tracker: IJupyterCadTracker,
    annotationModel: IAnnotationModel,
    formSchemaRegistry: IJCadFormSchemaRegistry
  ) => {
    const controlModel = new ControlPanelModel({ tracker });

    const leftControlPanel = new LeftPanelWidget({
      model: controlModel,
      annotationModel,
      tracker
    });
    leftControlPanel.id = 'jupytercad::leftControlPanel';
    leftControlPanel.title.caption = 'JupyterCad Control Panel';
    leftControlPanel.title.icon = jcLightIcon;

    const rightControlPanel = new RightPanelWidget({
      model: controlModel,
      tracker,
      formSchemaRegistry
    });
    rightControlPanel.id = 'jupytercad::rightControlPanel';
    rightControlPanel.title.caption = 'JupyterCad Control Panel';
    rightControlPanel.title.icon = jcLightIcon;

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
  mainMenu.fileMenu.addItem({
    command: CommandIDs.exportJcad
  });
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
