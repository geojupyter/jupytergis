import {
  ICollaborativeDrive,
  SharedDocumentFactory
} from '@jupyter/collaborative-drive';
import {
  IJGISExternalCommandRegistry,
  IJGISExternalCommandRegistryToken,
  JupyterGISDoc
} from '@jupytergis/schema';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  Dialog,
  ICommandPalette,
  IThemeManager,
  InputDialog,
  WidgetTracker,
  showDialog,
  showErrorMessage
} from '@jupyterlab/apputils';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { ConsolePanel, IConsoleTracker } from '@jupyterlab/console';
import { PathExt } from '@jupyterlab/coreutils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Widget } from '@lumino/widgets';

import {
  JupyterGISWidget,
  logoMiniIcon,
  logoMiniIconQGZ,
  requestAPI
} from '@jupytergis/base';
import { JupyterGISWidgetFactory } from '@jupytergis/jupytergis-core';
import { IJupyterGISDocTracker, IJupyterGISWidget } from '@jupytergis/schema';
import { QGSModelFactory, QGZModelFactory } from './modelfactory';

/**
 * The command IDs used by the qgis plugin.
 */
namespace CommandIDs {
  export const exportQgis = 'jupytergis:export';
}

/**
 * The response from server when exporting a project to QGIS.
 */
interface IExportResponse {
  /**
   * Whether the project has been exported or not.
   */
  exported: boolean;
  /**
   * The path of the exported project.
   */
  path: string;
  /**
   * The logs during export.
   */
  logs: {
    warnings: string[];
    errors: string[];
  };
}

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
  commandPalette: ICommandPalette | null
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
    contentType: 'QGS',
    icon: logoMiniIcon
  });
  app.docRegistry.addFileType({
    name: 'QGZ',
    displayName: 'QGZ',
    mimeTypes: ['application/octet-stream'],
    extensions: ['.qgz', '.QGZ'],
    fileFormat: 'base64',
    contentType: 'QGZ',
    icon: logoMiniIconQGZ
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
    widget.title.icon = logoMiniIconQGZ;
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

  /**
   * The command to export the current main area jGIS project to QGIS file ('.qgz').
   *
   * A popup opens to choose a filepath (local from the current jGIS file) if the
   * filepath is not provided in args.
   */
  if (installed) {
    app.commands.addCommand(CommandIDs.exportQgis, {
      label: 'Export To QGZ',
      isEnabled: () =>
        tracker.currentWidget
          ? tracker.currentWidget.context.model.sharedModel.editable
          : false,
      execute: async args => {
        const sourceExtension = '.jGIS';
        const extension = '.qgz';
        const model = tracker.currentWidget?.context.model.sharedModel;
        if (!model) {
          return;
        }
        const sourcePath = tracker.currentWidget.context.localPath;

        let filepath: string | null = (args.filepath as string) ?? null;
        if (!filepath) {
          filepath = (
            await InputDialog.getText({
              label: 'File name',
              placeholder: PathExt.basename(sourcePath, sourceExtension),
              title: 'Export the project to QGZ file'
            })
          ).value;
        }

        if (filepath === null) {
          // no-op if the dialog has been cancelled.
          return;
        } else if (!filepath) {
          // create the filepath if the dialog has been validated empty.
          filepath = `${PathExt.basename(sourcePath, sourceExtension)}${extension}`;
        } else if (!filepath.endsWith(extension)) {
          // add the extension to the path if it does not exist.
          filepath = `${filepath}${extension}`;
        }

        let dir = PathExt.dirname(sourcePath);
        if (dir.includes(':')) {
          dir = dir.split(':')[1];
        }
        const absolutePath = PathExt.join(dir, filepath);

        const virtualFile = {
          layers: model.layers,
          sources: model.sources,
          layerTree: model.layerTree.slice().reverse(),
          options: model.options
        };

        // Check if the file exists
        let fileExist = true;
        await drive.get(absolutePath, { content: false }).catch(() => {
          fileExist = false;
        });
        if (fileExist) {
          const overwrite = await showDialog({
            title: 'Export the project to QGZ file',
            body: `The file ${filepath} already exists.\nDo you want to overwrite it ?`
          });
          if (!overwrite.button.accept) {
            return;
          }
        }
        const response = await requestAPI<IExportResponse>(
          'jupytergis_qgis/export',
          {
            method: 'POST',
            body: JSON.stringify({
              path: absolutePath,
              virtual_file: virtualFile
            })
          }
        );
        if (!response.exported) {
          showErrorMessage(
            'Export the project to QGZ file',
            response.logs.errors.length
              ? response.logs.errors.join('\n')
              : 'Unknown error'
          );
        } else if (response.logs.warnings.length) {
          const bodyElement = document.createElement('pre');
          bodyElement.textContent = `${filepath} has been exported with warnings\n  - ${response.logs.warnings.join('\n  - ')}`;
          const body = new Widget({ node: bodyElement });
          await showDialog<HTMLPreElement>({
            title: 'Export the project to QGZ file',
            body,
            buttons: [Dialog.okButton()]
          });
        }
      }
    });

    if (commandPalette) {
      commandPalette.addItem({
        command: CommandIDs.exportQgis,
        category: 'JupyterGIS'
      });
    }
  }

  console.log('@jupytergis/jupytergis-qgis:qgisplugin is activated!');
};

export const qgisplugin: JupyterFrontEndPlugin<void> = {
  id: '@jupytergis/jupytergis-qgis:qgisplugin',
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
  optional: [ICommandPalette],
  autoStart: true,
  activate
};
