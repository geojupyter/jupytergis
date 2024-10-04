import {
  ICollaborativeDrive,
  SharedDocumentFactory
} from '@jupyter/docprovider';
import {
  IJGISExternalCommandRegistry,
  IJGISExternalCommandRegistryToken,
  IJupyterGISDocTracker,
  IJupyterGISWidget,
  JupyterGISDoc
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
import { IEditorServices } from '@jupyterlab/codeeditor';
import { ConsolePanel, IConsoleTracker } from '@jupyterlab/console';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { ILauncher } from '@jupyterlab/launcher';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { CommandIDs, logoIcon } from '@jupytergis/base';
import { JupyterGISWidgetFactory } from '../factory';
import { JupyterGISModelFactory } from './modelfactory';

const FACTORY = 'JupyterGIS .jgis Viewer';
const PALETTE_CATEGORY = 'JupyterGIS';

const activate = (
  app: JupyterFrontEnd,
  tracker: WidgetTracker<IJupyterGISWidget>,
  themeManager: IThemeManager,
  browserFactory: IFileBrowserFactory,
  externalCommandRegistry: IJGISExternalCommandRegistry,
  contentFactory: ConsolePanel.IContentFactory,
  editorServices: IEditorServices,
  rendermime: IRenderMimeRegistry,
  consoleTracker: IConsoleTracker,
  launcher: ILauncher | null,
  palette: ICommandPalette | null,
  drive: ICollaborativeDrive | null
): void => {
  const widgetFactory = new JupyterGISWidgetFactory({
    name: FACTORY,
    modelName: 'jupytergis-jgismodel',
    fileTypes: ['jgis'],
    defaultFor: ['jgis'],
    tracker,
    commands: app.commands,
    externalCommandRegistry,
    drive,
    manager: app.serviceManager,
    contentFactory,
    rendermime,
    mimeTypeService: editorServices.mimeTypeService,
    consoleTracker
  });
  // Registering the widget factory
  app.docRegistry.addWidgetFactory(widgetFactory);

  // Creating and registering the model factory for our custom DocumentModel
  const modelFactory = new JupyterGISModelFactory();
  app.docRegistry.addModelFactory(modelFactory);
  // register the filetype
  app.docRegistry.addFileType({
    name: 'jgis',
    displayName: 'JGIS',
    mimeTypes: ['text/json'],
    extensions: ['.jgis', '.JGIS'],
    fileFormat: 'text',
    contentType: 'jgis'
  });

  const jGISSharedModelFactory: SharedDocumentFactory = () => {
    return new JupyterGISDoc();
  };
  if (drive) {
    drive.sharedModelFactory.registerDocumentFactory(
      'jgis',
      jGISSharedModelFactory
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
    app.shell.activateById('jupytergis::leftControlPanel');
    app.shell.activateById('jupytergis::rightControlPanel');
  });

  app.commands.addCommand(CommandIDs.createNew, {
    label: args => 'New JGIS File',
    caption: 'Create a new JGIS Editor',
    icon: args => logoIcon,
    execute: async args => {
      // Get the directory in which the JGIS file must be created;
      // otherwise take the current filebrowser directory
      const cwd = (args['cwd'] ||
        browserFactory.tracker.currentWidget?.model.path) as string;

      // Create a new untitled GIS file
      let model = await app.serviceManager.contents.newUntitled({
        path: cwd,
        type: 'file',
        ext: '.jGIS'
      });

      model = await app.serviceManager.contents.save(model.path, {
        ...model,
        format: 'text',
        size: undefined,
        content:
          '{\n\t"layers": {},\n\t"sources": {},\n\t"options": {"latitude": 0, "longitude": 0, "zoom": 0, "bearing": 0, "pitch": 0, "projection": "EPSG:3857"},\n\t"layerTree": [],\n}'
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

    palette.addItem({
      command: CommandIDs.openLayerBrowser,
      category: 'JupyterGIS'
    });

    // Layers and Sources
    palette.addItem({
      command: CommandIDs.newRasterEntry,
      category: 'JupyterGIS'
    });

    palette.addItem({
      command: CommandIDs.newVectorTileEntry,
      category: 'JupyterGIS'
    });

    palette.addItem({
      command: CommandIDs.newGeoJSONEntry,
      category: 'JupyterGIS'
    });

    palette.addItem({
      command: CommandIDs.newHillshadeEntry,
      category: 'JupyterGIS'
    });

    // Source only
    palette.addItem({
      command: CommandIDs.newRasterSource,
      category: 'JupyterGIS'
    });

    palette.addItem({
      command: CommandIDs.newRasterDemSource,
      category: 'JupyterGIS'
    });

    palette.addItem({
      command: CommandIDs.newVectorSource,
      category: 'JupyterGIS'
    });

    palette.addItem({
      command: CommandIDs.newGeoJSONSource,
      category: 'JupyterGIS'
    });

    // Layers only
    palette.addItem({
      command: CommandIDs.newRasterLayer,
      category: 'JupyterGIS'
    });

    palette.addItem({
      command: CommandIDs.newVectorLayer,
      category: 'JupyterGIS'
    });

    palette.addItem({
      command: CommandIDs.newHillshadeLayer,
      category: 'JupyterGIS'
    });

    // Layer and group actions
    palette.addItem({
      command: CommandIDs.moveLayerToNewGroup,
      category: 'JupyterGIS'
    });
  }
};

const jGISPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterGIS:jGISplugin',
  requires: [
    IJupyterGISDocTracker,
    IThemeManager,
    IFileBrowserFactory,
    IJGISExternalCommandRegistryToken,
    ConsolePanel.IContentFactory,
    IEditorServices,
    IRenderMimeRegistry,
    IConsoleTracker
  ],
  optional: [ILauncher, ICommandPalette, ICollaborativeDrive],
  autoStart: true,
  activate
};

export default jGISPlugin;
