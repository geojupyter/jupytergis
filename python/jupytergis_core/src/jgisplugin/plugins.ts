import {
  ICollaborativeDrive,
  SharedDocumentFactory
} from '@jupyter/docprovider';
import {
  IAnnotationModel,
  IAnnotationToken,
  IJCadExternalCommandRegistry,
  IJCadExternalCommandRegistryToken,
  IJupyterCadDocTracker,
  IJupyterCadWidget,
  JupyterCadDoc
} from '@jupytergis/schema';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  ICommandPalette,
  IThemeManager,
  WidgetTracker
} from '@jupyterlab/apputils';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { ILauncher } from '@jupyterlab/launcher';
import { fileIcon } from '@jupyterlab/ui-components';

import { JupyterCadWidgetFactory } from '../factory';
import { JupyterCadJcadModelFactory } from './modelfactory';

const FACTORY = 'JupyterCAD .jcad Viewer';
const PALETTE_CATEGORY = 'JupyterCAD';

namespace CommandIDs {
  export const createNew = 'jupytercad:create-new-jGIS-file';
}

const activate = (
  app: JupyterFrontEnd,
  tracker: WidgetTracker<IJupyterCadWidget>,
  themeManager: IThemeManager,
  annotationModel: IAnnotationModel,
  browserFactory: IFileBrowserFactory,
  externalCommandRegistry: IJCadExternalCommandRegistry,
  launcher: ILauncher | null,
  palette: ICommandPalette | null,
  drive: ICollaborativeDrive | null
): void => {
  const widgetFactory = new JupyterCadWidgetFactory({
    name: FACTORY,
    modelName: 'jupytercad-jcadmodel',
    fileTypes: ['jcad'],
    defaultFor: ['jcad'],
    tracker,
    commands: app.commands,
    externalCommandRegistry
  });
  // Registering the widget factory
  app.docRegistry.addWidgetFactory(widgetFactory);

  // Creating and registering the model factory for our custom DocumentModel
  const modelFactory = new JupyterCadJcadModelFactory({
    annotationModel
  });
  app.docRegistry.addModelFactory(modelFactory);
  // register the filetype
  app.docRegistry.addFileType({
    name: 'jcad',
    displayName: 'JCAD',
    mimeTypes: ['text/json'],
    extensions: ['.jcad', '.JCAD'],
    fileFormat: 'text',
    contentType: 'jcad'
  });

  const jcadSharedModelFactory: SharedDocumentFactory = () => {
    return new JupyterCadDoc();
  };
  if (drive) {
    drive.sharedModelFactory.registerDocumentFactory(
      'jcad',
      jcadSharedModelFactory
    );
  }

  widgetFactory.widgetCreated.connect((sender, widget) => {
    widget.context.pathChanged.connect(() => {
      tracker.save(widget);
    });
    themeManager.themeChanged.connect((_, changes) =>
      widget.context.model.themeChanged.emit(changes)
    );
    tracker.add(widget);
    app.shell.activateById('jupytercad::leftControlPanel');
    app.shell.activateById('jupytercad::rightControlPanel');
  });

  app.commands.addCommand(CommandIDs.createNew, {
    label: args => 'New JCAD File',
    caption: 'Create a new JCAD Editor',
    icon: args => (args['isPalette'] ? undefined : fileIcon),
    execute: async args => {
      // Get the directory in which the JCAD file must be created;
      // otherwise take the current filebrowser directory
      const cwd = (args['cwd'] ||
        browserFactory.tracker.currentWidget?.model.path) as string;

      // Create a new untitled Blockly file
      let model = await app.serviceManager.contents.newUntitled({
        path: cwd,
        type: 'file',
        ext: '.jcad'
      });

      model = await app.serviceManager.contents.save(model.path, {
        ...model,
        format: 'text',
        size: undefined,
        content:
          '{\n\t"objects": [],\n\t"options": {},\n\t"metadata": {},\n\t"outputs": {}}'
      });

      // Open the newly created file with the 'Editor'
      return app.commands.execute('docmanager:open', {
        path: model.path,
        factory: FACTORY
      });
    }
  });

  // Add the command to the launcher
  if (launcher) {
    launcher.add({
      command: CommandIDs.createNew,
      category: 'Other',
      rank: 1
    });
  }

  // Add the command to the palette
  if (palette) {
    palette.addItem({
      command: CommandIDs.createNew,
      args: { isPalette: true },
      category: PALETTE_CATEGORY
    });
  }
};

const jcadPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytercad:jcadplugin',
  requires: [
    IJupyterCadDocTracker,
    IThemeManager,
    IAnnotationToken,
    IFileBrowserFactory,
    IJCadExternalCommandRegistryToken
  ],
  optional: [ILauncher, ICommandPalette, ICollaborativeDrive],
  autoStart: true,
  activate
};

export default jcadPlugin;
