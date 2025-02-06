import { ICollaborativeDrive } from '@jupyter/collaborative-drive';
import {
  JupyterGISOutputWidget,
  JupyterGISPanel,
  JupyterGISTracker,
  ToolbarWidget
} from '@jupytergis/base';
import {
  IJGISExternalCommandRegistry,
  IJGISExternalCommandRegistryToken,
  IJupyterGISDoc,
  IJupyterGISDocTracker,
  JupyterGISModel
} from '@jupytergis/schema';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { showErrorMessage } from '@jupyterlab/apputils';
import { ConsolePanel } from '@jupyterlab/console';
import { PathExt } from '@jupyterlab/coreutils';
import { NotebookPanel } from '@jupyterlab/notebook';
import { Contents } from '@jupyterlab/services';
import { Toolbar } from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { MessageLoop } from '@lumino/messaging';
import { Panel, Widget } from '@lumino/widgets';
import * as Y from 'yjs';
import {
  IJupyterYWidget,
  IJupyterYWidgetManager,
  // JupyterYDoc,
  JupyterYModel
} from 'yjs-widgets';

export interface ICommMetadata {
  create_ydoc: boolean;
  path: string;
  format: string;
  contentType: string;
  ymodel_name: string;
}

export const CLASS_NAME = 'jupytergis-notebook-widget';

export class YJupyterGISModel extends JupyterYModel {
  jupyterGISModel: JupyterGISModel;
}

export class YJupyterGISLuminoWidget extends Panel {
  constructor(options: IOptions) {
    super();
    const { model } = options;
    this.addClass(CLASS_NAME);

    this._buildWidget(options);

    // If the filepath was not set when building the widget, the toolbar is not built.
    // The widget has to be built again to include the toolbar.
    const onchange = (_: any, args: any) => {
      if (args.stateChange) {
        args.stateChange.forEach((change: any) => {
          if (change.name === 'path') {
            this.layout?.removeWidget(this._jgisWidget);
            this._jgisWidget.dispose();
            this._buildWidget(options);
          }
        });
      }
    };

    model.sharedModel.changed.connect(onchange);
  }

  get jgisWidget(): JupyterGISOutputWidget {
    return this._jgisWidget;
  }

  /**
   * Build the widget and add it to the panel.
   * @param options
   */
  private _buildWidget = (options: IOptions) => {
    const { commands, model, externalCommands, tracker } = options;
    // Ensure the model filePath is relevant with the shared model path.
    if (model.sharedModel.getState('path')) {
      model.filePath = model.sharedModel.getState('path') as string;
    }
    const content = new JupyterGISPanel({ model });
    let toolbar: Toolbar | undefined = undefined;
    if (model.filePath) {
      toolbar = new ToolbarWidget({
        commands,
        model,
        externalCommands: externalCommands?.getCommands() || []
      });
    }
    this._jgisWidget = new JupyterGISOutputWidget({
      model,
      content,
      toolbar
    });
    this.addWidget(this._jgisWidget);
    tracker?.add(this._jgisWidget);
  };

  private _jgisWidget: JupyterGISOutputWidget;
}

interface IOptions {
  commands: CommandRegistry;
  model: JupyterGISModel;
  externalCommands?: IJGISExternalCommandRegistry;
  tracker?: JupyterGISTracker;
}

export const notebookRendererPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytergis:yjswidget-plugin',
  autoStart: true,
  optional: [
    IJGISExternalCommandRegistryToken,
    IJupyterGISDocTracker,
    IJupyterYWidgetManager,
    ICollaborativeDrive
  ],
  activate: (
    app: JupyterFrontEnd,
    externalCommandRegistry?: IJGISExternalCommandRegistry,
    jgisTracker?: JupyterGISTracker,
    yWidgetManager?: IJupyterYWidgetManager,
    drive?: ICollaborativeDrive
  ): void => {
    if (!yWidgetManager) {
      console.error('Missing IJupyterYWidgetManager token!');
      return;
    }

    class YJupyterGISModelFactory extends YJupyterGISModel {
      async ydocFactory(commMetadata: ICommMetadata): Promise<Y.Doc> {
        const { path, format, contentType } = commMetadata;
        const fileFormat = format as Contents.FileFormat;

        if (!drive) {
          showErrorMessage(
            'Error using the JupyterGIS Python API',
            'You cannot use the JupyterGIS Python API without a collaborative drive. You need to install a package providing collaboration features (e.g. jupyter-collaboration).'
          );
          throw new Error(
            'Failed to create the YDoc without a collaborative drive'
          );
        }

        // The path of the project is relative to the path of the notebook
        let currentWidgetPath: string = '';
        const currentWidget = app.shell.currentWidget;
        if (
          currentWidget instanceof NotebookPanel ||
          currentWidget instanceof ConsolePanel
        ) {
          currentWidgetPath = currentWidget.sessionContext.path;
        }

        let localPath = '';
        let fileless = false;
        if (path) {
          localPath = PathExt.join(PathExt.dirname(currentWidgetPath), path);

          // If the file does not exist yet, create it
          try {
            await app.serviceManager.contents.get(localPath);
          } catch (e) {
            await app.serviceManager.contents.save(localPath, {
              content: btoa('{}'),
              format: 'base64'
            });
          }
        } else {
          // If the user did not provide a path, do not create
          localPath = PathExt.join(
            PathExt.dirname(currentWidgetPath),
            'unsaved_project'
          );
          fileless = true;
        }

        const sharedModel = drive!.sharedModelFactory.createNew({
          path: localPath,
          format: fileFormat,
          contentType,
          collaborative: true
        })!;
        this.jupyterGISModel = new JupyterGISModel({
          sharedModel: sharedModel as IJupyterGISDoc
        });

        this.jupyterGISModel.contentsManager = app.serviceManager.contents;

        if (fileless) {
          this.jupyterGISModel.filePath = localPath;
        }

        return this.jupyterGISModel.sharedModel.ydoc;
      }
    }

    class YJupyterGISWidget implements IJupyterYWidget {
      constructor(yModel: YJupyterGISModel, node: HTMLElement) {
        this.yModel = yModel;
        this.node = node;
        const widget = new YJupyterGISLuminoWidget({
          commands: app.commands,
          model: yModel.jupyterGISModel,
          externalCommands: externalCommandRegistry,
          tracker: jgisTracker
        });
        this._jgisWidget = widget.jgisWidget;

        MessageLoop.sendMessage(widget, Widget.Msg.BeforeAttach);
        node.appendChild(widget.node);
        MessageLoop.sendMessage(widget, Widget.Msg.AfterAttach);
      }

      dispose(): void {
        // Dispose of the widget.
        this._jgisWidget.dispose();
      }

      readonly yModel: YJupyterGISModel;
      readonly node: HTMLElement;
      private _jgisWidget: JupyterGISOutputWidget;
    }

    yWidgetManager.registerWidget(
      '@jupytergis:widget',
      YJupyterGISModelFactory,
      YJupyterGISWidget
    );
  }
};
