import {
  ICollaborativeDrive,
  SharedDocumentFactory
} from '@jupyter/docprovider';
import {
  JupyterGISDoc,
  IJGISExternalCommandRegistry,
  IJGISExternalCommandRegistryToken
} from '@jupytergis/schema';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  IThemeManager,
  showErrorMessage,
  WidgetTracker
} from '@jupyterlab/apputils';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { ConsolePanel, IConsoleTracker } from '@jupyterlab/console';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { JupyterGISWidgetFactory } from '@jupytergis/jupytergis-core';
import { IJupyterGISDocTracker, IJupyterGISWidget } from '@jupytergis/schema';
import { JupyterGISWidget, requestAPI } from '@jupytergis/base';
import { QGSModelFactory, QGZModelFactory } from './modelfactory';

const activate = async (
  app: JupyterFrontEnd,
  tracker: WidgetTracker<IJupyterGISWidget>,
  themeManager: IThemeManager,
  drive: ICollaborativeDrive,
  externalCommandRegistry: IJGISExternalCommandRegistry,
  contentFactory: ConsolePanel.IContentFactory,
  editorServices: IEditorServices,
  rendermime: IRenderMimeRegistry,
  consoleTracker: IConsoleTracker
): Promise<void> => {
  const fcCheck = await requestAPI<{ installed: boolean }>(
    'jupytergis_qgis/backend-check',
    {
      method: 'POST',
      body: JSON.stringify({})
    }
  );
  const { installed } = fcCheck;
  const backendCheck = () => {
    if (!installed) {
      showErrorMessage(
        'QGIS is not installed',
        'QGIS is required to open QGIS files'
      );
    }
    return installed;
  };
  const QGSWidgetFactory = new JupyterGISWidgetFactory({
    name: 'JupyterGIS QGS Factory',
    modelName: 'jupytergis-qgsmodel',
    fileTypes: ['QGS'],
    defaultFor: ['QGS'],
    tracker,
    commands: app.commands,
    externalCommandRegistry,
    backendCheck,
    manager: app.serviceManager,
    contentFactory,
    rendermime,
    mimeTypeService: editorServices.mimeTypeService,
    consoleTracker
  });
  const QGZWidgetFactory = new JupyterGISWidgetFactory({
    name: 'JupyterGIS QGZ Factory',
    modelName: 'jupytergis-qgzmodel',
    fileTypes: ['QGZ'],
    defaultFor: ['QGZ'],
    tracker,
    commands: app.commands,
    externalCommandRegistry,
    backendCheck,
    manager: app.serviceManager,
    contentFactory,
    rendermime,
    mimeTypeService: editorServices.mimeTypeService,
    consoleTracker
  });

  // Registering the widget factory
  app.docRegistry.addWidgetFactory(QGSWidgetFactory);
  app.docRegistry.addWidgetFactory(QGZWidgetFactory);

  // Creating and registering the model factory for our custom DocumentModel
  app.docRegistry.addModelFactory(new QGSModelFactory());
  app.docRegistry.addModelFactory(new QGZModelFactory());
  // register the filetype
  app.docRegistry.addFileType({
    name: 'QGS',
    displayName: 'QGS',
    mimeTypes: ['application/octet-stream'],
    extensions: ['.qgs', '.QGS'],
    fileFormat: 'base64',
    contentType: 'QGS'
  });
  app.docRegistry.addFileType({
    name: 'QGZ',
    displayName: 'QGZ',
    mimeTypes: ['application/octet-stream'],
    extensions: ['.qgz', '.QGZ'],
    fileFormat: 'base64',
    contentType: 'QGZ'
  });

  const QGISSharedModelFactory: SharedDocumentFactory = () => {
    return new JupyterGISDoc();
  };
  drive.sharedModelFactory.registerDocumentFactory(
    'QGS',
    QGISSharedModelFactory
  );
  drive.sharedModelFactory.registerDocumentFactory(
    'QGZ',
    QGISSharedModelFactory
  );

  const widgetCreatedCallback = (sender: any, widget: JupyterGISWidget) => {
    // Notify the instance tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => {
      tracker.save(widget);
    });
    themeManager.themeChanged.connect((_, changes) =>
      widget.context.model.themeChanged.emit(changes)
    );

    tracker.add(widget);
    app.shell.activateById('jupytergis::leftControlPanel');
    app.shell.activateById('jupytergis::rightControlPanel');
  };

  QGSWidgetFactory.widgetCreated.connect(widgetCreatedCallback);
  QGZWidgetFactory.widgetCreated.connect(widgetCreatedCallback);

  console.log('jupytergis:qgisplugin is activated!');
};

export const qgisplugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytergis:qgisplugin',
  requires: [
    IJupyterGISDocTracker,
    IThemeManager,
    ICollaborativeDrive,
    IJGISExternalCommandRegistryToken,
    ConsolePanel.IContentFactory,
    IEditorServices,
    IRenderMimeRegistry,
    IConsoleTracker
  ],
  autoStart: true,
  activate
};
