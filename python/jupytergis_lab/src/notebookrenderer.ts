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
  IJupyterGISWidgetContext,
  JupyterGISModel
} from '@jupytergis/schema';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { Contents } from '@jupyterlab/services';
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
  constructor(options: {
    commands: CommandRegistry;
    model: JupyterGISModel;
    externalCommands: IJGISExternalCommandRegistry;
  }) {
    super();
    const { commands, model, externalCommands } = options;
    this.addClass(CLASS_NAME);
    const content = new JupyterGISPanel({ model });
    const toolbar = new ToolbarWidget({
      commands,
      model,
      externalCommands: externalCommands.getCommands()
    });
    const context: IJupyterGISWidgetContext = {
      model,
      path: model.filePath
    };
    this._jgisWidget = new JupyterGISOutputWidget({
      context,
      content,
      toolbar
    });

    this.addWidget(this._jgisWidget);
  }

  get jgisWidget(): JupyterGISOutputWidget {
    return this._jgisWidget;
  }

  onResize = (): void => {
    if (this._jgisWidget) {
      MessageLoop.sendMessage(
        this._jgisWidget,
        Widget.ResizeMessage.UnknownSize
      );
    }
  };

  private _jgisWidget: JupyterGISOutputWidget;
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
    externalCommandRegistry: IJGISExternalCommandRegistry,
    jgisTracker: JupyterGISTracker,
    yWidgetManager?: IJupyterYWidgetManager,
    drive?: ICollaborativeDrive
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
        const onchange = (_: any, args: any) => {
          if (args.stateChange) {
            args.stateChange.forEach((change: any) => {
              if (change.name === 'path') {
                this.jupyterGISModel.filePath = change.newValue;
              }
            });
          }
        };

        this.jupyterGISModel.contentsManager = app.serviceManager.contents;
        sharedModel.changed.connect(onchange);

        if (sharedModel.getState('path')) {
          this.jupyterGISModel.filePath = sharedModel.getState(
            'path'
          ) as string;
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
