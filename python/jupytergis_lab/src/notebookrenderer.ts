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
import { ConsolePanel, IConsoleTracker } from '@jupyterlab/console';
import { PathExt } from '@jupyterlab/coreutils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Contents } from '@jupyterlab/services';
import { Toolbar } from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { MessageLoop } from '@lumino/messaging';
import { Panel, Widget } from '@lumino/widgets';
import * as Y from 'yjs';
import {
  IJupyterYWidget,
  IJupyterYWidgetManager,
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
            model.filePath = change.newValue;
            this.layout?.removeWidget(this._jgisWidget);
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
    const { commands, model, externalCommands } = options;
    const content = new JupyterGISPanel({ model });
    let toolbar: Toolbar | undefined = undefined;
    if (model.filePath) {
      toolbar = new ToolbarWidget({
        commands,
        model,
        externalCommands: externalCommands.getCommands()
      });
    }
    this._jgisWidget = new JupyterGISOutputWidget({
      model,
      content,
      toolbar
    });
    this.addWidget(this._jgisWidget);
  };

  private _jgisWidget: JupyterGISOutputWidget;
}

interface IOptions {
  commands: CommandRegistry;
  model: JupyterGISModel;
  externalCommands: IJGISExternalCommandRegistry;
}

export const notebookRendererPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytergis:yjswidget-plugin',
  autoStart: true,
  optional: [
    IJGISExternalCommandRegistryToken,
    IJupyterGISDocTracker,
    IJupyterYWidgetManager,
    ICollaborativeDrive,
    IConsoleTracker,
    INotebookTracker
  ],
  activate: (
    app: JupyterFrontEnd,
    externalCommandRegistry: IJGISExternalCommandRegistry,
    jgisTracker: JupyterGISTracker,
    yWidgetManager?: IJupyterYWidgetManager,
    drive?: ICollaborativeDrive,
    consoleTracker?: IConsoleTracker,
    notebookTracker?: INotebookTracker
  ): void => {
    if (!yWidgetManager) {
      console.error('Missing IJupyterYWidgetManager token!');
      return;
    }
    if (!drive) {
      console.error(
        'Cannot setup JupyterGIS Python API without a collaborative drive'
      );
      return;
    }
    class YJupyterGISModelFactory extends YJupyterGISModel {
      ydocFactory(commMetadata: ICommMetadata): Y.Doc {
        const { path, format, contentType } = commMetadata;
        const fileFormat = format as Contents.FileFormat;
        const sharedModel = drive!.sharedModelFactory.createNew({
          path,
          format: fileFormat,
          contentType,
          collaborative: true
        })!;
        this.jupyterGISModel = new JupyterGISModel({
          sharedModel: sharedModel as IJupyterGISDoc
        });

        this.jupyterGISModel.contentsManager = app.serviceManager.contents;
        if (sharedModel) {
          if (sharedModel.getState('path')) {
            this.jupyterGISModel.filePath = sharedModel.getState(
              'path'
            ) as string;
          }
        } else {
          // The path of the project is set to the path of the notebook, to be able to
          // add local geoJSON/shape file in a "file-less" project.
          const currentWidget = app.shell.currentWidget;
          let currentPath: string | undefined = undefined;
          if (currentWidget instanceof NotebookPanel && notebookTracker) {
            currentPath = notebookTracker.currentWidget?.context.localPath;
          } else if (currentWidget instanceof ConsolePanel && consoleTracker) {
            currentPath = consoleTracker.currentWidget?.sessionContext.path;
          }
          if (currentPath) {
            this.jupyterGISModel.filePath = PathExt.join(
              PathExt.dirname(currentPath),
              'unsaved_project'
            );
          }
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
          externalCommands: externalCommandRegistry
        });
        // Widget.attach(widget, node);
        jgisTracker.add(widget.jgisWidget);
        MessageLoop.sendMessage(widget, Widget.Msg.BeforeAttach);
        node.appendChild(widget.node);
        MessageLoop.sendMessage(widget, Widget.Msg.AfterAttach);
      }

      readonly yModel: YJupyterGISModel;
      readonly node: HTMLElement;
    }

    yWidgetManager.registerWidget(
      '@jupytergis:widget',
      YJupyterGISModelFactory,
      YJupyterGISWidget
    );
  }
};
