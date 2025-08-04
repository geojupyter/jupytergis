import {
  ICollaborativeDrive,
  SharedDocumentFactory,
} from '@jupyter/collaborative-drive';
import { CommandIDs, logoIcon, logoMiniIcon } from '@jupytergis/base';
import {
  IAnnotationModel,
  IAnnotationToken,
  IJGISExternalCommandRegistry,
  IJGISExternalCommandRegistryToken,
  IJupyterGISDocTracker,
  IJupyterGISWidget,
  JupyterGISDoc,
  SCHEMA_VERSION,
  ProcessingMerge,
  IJGISFormSchemaRegistry,
  IJGISFormSchemaRegistryToken,
} from '@jupytergis/schema';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';
import {
  ICommandPalette,
  IThemeManager,
  WidgetTracker,
} from '@jupyterlab/apputils';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { ConsolePanel, IConsoleTracker } from '@jupyterlab/console';
import { PageConfig } from '@jupyterlab/coreutils';
import { MimeDocumentFactory } from '@jupyterlab/docregistry';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { ILauncher } from '@jupyterlab/launcher';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IStateDB } from '@jupyterlab/statedb';

import { JupyterGISDocumentWidgetFactory } from '../factory';
import { JupyterGISModelFactory } from './modelfactory';

const FACTORY = 'JupyterGIS .jgis Viewer';
const CONTENT_TYPE = 'jgis';
const PALETTE_CATEGORY = 'JupyterGIS';
const MODEL_NAME = 'jupytergis-jgismodel';
const SETTINGS_ID = '@jupytergis/jupytergis-core:jupytergis-settings';

const activate = async (
  app: JupyterFrontEnd,
  tracker: WidgetTracker<IJupyterGISWidget>,
  themeManager: IThemeManager,
  browserFactory: IFileBrowserFactory,
  externalCommandRegistry: IJGISExternalCommandRegistry,
  contentFactory: ConsolePanel.IContentFactory,
  editorServices: IEditorServices,
  rendermime: IRenderMimeRegistry,
  consoleTracker: IConsoleTracker,
  annotationModel: IAnnotationModel,
  settingRegistry: ISettingRegistry,
  formSchemaRegistry: IJGISFormSchemaRegistry,
  state: IStateDB,
  launcher: ILauncher | null,
  palette: ICommandPalette | null,
  drive: ICollaborativeDrive | null,
): Promise<void> => {
  formSchemaRegistry && state;
  if (PageConfig.getOption('jgis_expose_maps')) {
    window.jupytergisMaps = {};
  }

  let settings: ISettingRegistry.ISettings | null = null;

  try {
    settings = await settingRegistry.load(SETTINGS_ID);
    console.log(`Loaded settings for ${SETTINGS_ID}`, settings);
  } catch (error) {
    console.warn(`Failed to load settings for ${SETTINGS_ID}`, error);
  }

  const widgetFactory = new JupyterGISDocumentWidgetFactory({
    name: FACTORY,
    modelName: MODEL_NAME,
    fileTypes: [CONTENT_TYPE],
    defaultFor: [CONTENT_TYPE],
    tracker,
    commands: app.commands,
    externalCommandRegistry,
    manager: app.serviceManager,
    contentFactory,
    rendermime,
    mimeTypeService: editorServices.mimeTypeService,
    formSchemaRegistry: formSchemaRegistry,
    consoleTracker,
    state: state,
    annotationModel: annotationModel,
  });

  // Registering the widget factory
  app.docRegistry.addWidgetFactory(widgetFactory);

  const mimeDocumentFactory = new MimeDocumentFactory({
    dataType: 'json',
    rendermime,
    modelName: MODEL_NAME,
    name: 'JSON Editor',
    primaryFileType: app.docRegistry.getFileType('json'),
    fileTypes: [CONTENT_TYPE],
  });
  app.docRegistry.addWidgetFactory(mimeDocumentFactory);

  // Creating and registering the model factory for our custom DocumentModel
  const modelFactory = new JupyterGISModelFactory({
    annotationModel,
    settingRegistry,
  });
  app.docRegistry.addModelFactory(modelFactory);

  // register the filetype
  app.docRegistry.addFileType({
    name: CONTENT_TYPE,
    displayName: 'JGIS',
    mimeTypes: ['text/json'],
    extensions: ['.jgis', '.JGIS'],
    fileFormat: 'text',
    contentType: CONTENT_TYPE,
    icon: logoMiniIcon,
  });

  const jGISSharedModelFactory: SharedDocumentFactory = () => {
    return new JupyterGISDoc();
  };
  if (drive) {
    drive.sharedModelFactory.registerDocumentFactory(
      CONTENT_TYPE,
      jGISSharedModelFactory,
    );
  }

  widgetFactory.widgetCreated.connect((sender, widget) => {
    widget.title.icon = logoIcon;
    widget.context.pathChanged.connect(() => {
      tracker.save(widget);
    });
    themeManager.themeChanged.connect((_, changes) =>
      widget.model.themeChanged.emit(changes),
    );
    app.shell.activateById('jupytergis::leftControlPanel');
    app.shell.activateById('jupytergis::rightControlPanel');
    tracker
      .add(widget)
      .then(() => {
        Object.values(CommandIDs).forEach(id => {
          if (app.commands.hasCommand(id)) {
            app.commands.notifyCommandChanged(id);
          }
        });
      })
      .catch(e => {
        console.error('Cannot update JupyterGIS commands', e);
      });
  });

  app.commands.addCommand(CommandIDs.createNew, {
    label: args => (args['label'] as string) ?? 'GIS Project',
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
        ext: '.jGIS',
      });

      model = await app.serviceManager.contents.save(model.path, {
        ...model,
        format: 'text',
        size: undefined,
        content: `{\n\t"schemaVersion": "${SCHEMA_VERSION}",\n\t"layers": {},\n\t"sources": {},\n\t"options": {"latitude": 0, "longitude": 0, "zoom": 0, "bearing": 0, "pitch": 0, "projection": "EPSG:3857"},\n\t"layerTree": [],\n\t"metadata": {}\n}`,
      });

      // Open the newly created file with the 'Editor'
      return app.commands.execute('docmanager:open', {
        path: model.path,
        factory: FACTORY,
      });
    },
  });

  // Add the command to the launcher
  if (launcher) {
    launcher.add({
      command: CommandIDs.createNew,
      category: 'Other',
      rank: 1,
    });
  }

  // Add the command to the palette
  if (palette) {
    palette.addItem({
      command: CommandIDs.createNew,
      args: { isPalette: true },
      category: PALETTE_CATEGORY,
    });

    palette.addItem({
      command: CommandIDs.openLayerBrowser,
      category: 'JupyterGIS',
    });

    // Layers and Sources
    palette.addItem({
      command: CommandIDs.newRasterEntry,
      category: 'JupyterGIS',
    });

    palette.addItem({
      command: CommandIDs.newVectorTileEntry,
      category: 'JupyterGIS',
    });

    palette.addItem({
      command: CommandIDs.newGeoJSONEntry,
      category: 'JupyterGIS',
    });

    palette.addItem({
      command: CommandIDs.newHillshadeEntry,
      category: 'JupyterGIS',
    });

    // Layer and group actions
    palette.addItem({
      command: CommandIDs.moveLayerToNewGroup,
      category: 'JupyterGIS',
    });

    for (const processingElement of ProcessingMerge) {
      palette.addItem({
        command: processingElement.name,
        category: 'JupyterGIS',
      });
    }
  }

  // Inject “New JupyterGIS file” into the File Browser context menu
  app.contextMenu.addItem({
    command: CommandIDs.createNew,
    selector: '.jp-DirListing',
    rank: 55,
    args: { label: 'New JupyterGIS Project' },
  });
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
    IConsoleTracker,
    IAnnotationToken,
    ISettingRegistry,
    IJGISFormSchemaRegistryToken,
    IStateDB,
  ],
  optional: [ILauncher, ICommandPalette, ICollaborativeDrive],
  autoStart: true,
  activate,
};

export default jGISPlugin;
