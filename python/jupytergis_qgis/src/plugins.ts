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

import { JupyterGISWidgetFactory } from '@jupytergis/jupytergis-core';
import { IJupyterGISDocTracker, IJupyterGISWidget } from '@jupytergis/schema';
import { requestAPI } from '@jupytergis/base';
import { QGSModelFactory, QGZModelFactory } from './modelfactory';

const FACTORY = 'Jupytercad QGIS Factory';

const activate = async (
  app: JupyterFrontEnd,
  tracker: WidgetTracker<IJupyterGISWidget>,
  themeManager: IThemeManager,
  drive: ICollaborativeDrive,
  externalCommandRegistry: IJGISExternalCommandRegistry
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
  const widgetFactory = new JupyterGISWidgetFactory({
    name: FACTORY,
    modelName: 'jupytergis-qgismodel',
    fileTypes: ['QGS', 'QGZ'],
    defaultFor: ['QGS', 'QGZ'],
    tracker,
    commands: app.commands,
    externalCommandRegistry,
    backendCheck
  });

  // Registering the widget factory
  app.docRegistry.addWidgetFactory(widgetFactory);

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

  widgetFactory.widgetCreated.connect((sender, widget) => {
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
  });
  console.log('jupytergis:qgisplugin is activated!');
};

export const qgisplugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytergis:qgisplugin',
  requires: [
    IJupyterGISDocTracker,
    IThemeManager,
    ICollaborativeDrive,
    IJGISExternalCommandRegistryToken
  ],
  autoStart: true,
  activate
};
