import {
  ICollaborativeDrive,
  SharedDocumentFactory
} from '@jupyter/collaborative-drive';
import {
  IJupyterGISDocTracker,
  IJupyterGISWidget,
  IJGISExternalCommandRegistry,
  IJGISExternalCommandRegistryToken,
  IAnnotationModel,
  IAnnotationToken
} from '@jupytergis/schema';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IThemeManager, WidgetTracker } from '@jupyterlab/apputils';
import { ConsolePanel, IConsoleTracker } from '@jupyterlab/console';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ICommandPalette } from '@jupyterlab/apputils';

import { JupyterGISGeoJSONModelFactory } from './modelfactory';
import { JupyterGISDocumentWidgetFactory } from '../factory';
import { JupyterGISGeoJSONDoc } from './model';
import { logoMiniIcon, JupyterGISDocumentWidget } from '@jupytergis/base';

const FACTORY = 'JupyterGIS GeoJSON Viewer';
const SETTINGS_ID = '@jupytergis/jupytergis-core:jupytergis-settings';

const activate = async (
  app: JupyterFrontEnd,
  tracker: WidgetTracker<IJupyterGISWidget>,
  themeManager: IThemeManager,
  drive: ICollaborativeDrive,
  externalCommandRegistry: IJGISExternalCommandRegistry,
  contentFactory: ConsolePanel.IContentFactory,
  editorServices: IEditorServices,
  rendermime: IRenderMimeRegistry,
  consoleTracker: IConsoleTracker,
  annotationModel: IAnnotationModel,
  settingRegistry: ISettingRegistry,
  commandPalette: ICommandPalette | null
): Promise<void> => {
  let settings: ISettingRegistry.ISettings | null = null;

  if (settingRegistry) {
    try {
      settings = await settingRegistry.load(SETTINGS_ID);
      console.log(`Loaded settings for ${SETTINGS_ID}`, settings);
    } catch (error) {
      console.warn(`Failed to load settings for ${SETTINGS_ID}`, error);
    }
  } else {
    console.warn('No settingRegistry available; using default settings.');
  }

  const widgetFactory = new JupyterGISDocumentWidgetFactory({
    name: FACTORY,
    modelName: 'jupytergis-geojsonmodel',
    fileTypes: ['geojson'],
    defaultFor: ['geojson'],
    tracker,
    commands: app.commands,
    externalCommandRegistry,
    manager: app.serviceManager,
    contentFactory,
    rendermime,
    mimeTypeService: editorServices.mimeTypeService,
    consoleTracker
  });

  console.log("geojson widget factory created", widgetFactory);

  app.docRegistry.addWidgetFactory(widgetFactory);

  const modelFactory = new JupyterGISGeoJSONModelFactory({
    annotationModel,
    settingRegistry
  });
  app.docRegistry.addModelFactory(modelFactory);

  app.docRegistry.addFileType({
    name: 'geojson',
    displayName: 'GeoJSON',
    mimeTypes: ['application/json'],
    extensions: ['.geojson', '.GEOJSON'],
    fileFormat: 'text',
    contentType: 'geojson',
    icon: logoMiniIcon
  });

  const geojsonSharedModelFactory: SharedDocumentFactory = () => {
    return new JupyterGISGeoJSONDoc();
  };
  drive.sharedModelFactory.registerDocumentFactory(
    'geojson',
    geojsonSharedModelFactory
  );

  const widgetCreatedCallback = (
    sender: any,
    widget: JupyterGISDocumentWidget
  ) => {
    console.log("calling geojson widget callback");
    widget.title.icon = logoMiniIcon;
    widget.context.pathChanged.connect(() => {
      tracker.save(widget);
    }); 
    themeManager.themeChanged.connect((_, changes) =>
      widget.model.themeChanged.emit(changes)
    );
    tracker.add(widget);
  };

  widgetFactory.widgetCreated.connect(widgetCreatedCallback);
};

const geojsonPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupytergis/jupytergis-core:geojsonplugin',
  requires: [
    IJupyterGISDocTracker,
    IThemeManager,
    ICollaborativeDrive,
    IJGISExternalCommandRegistryToken,
    ConsolePanel.IContentFactory,
    IEditorServices,
    IRenderMimeRegistry,
    IConsoleTracker,
    IAnnotationToken,
    ISettingRegistry
  ],
  optional: [ICommandPalette],
  autoStart: true,
  activate
};

export default geojsonPlugin;
