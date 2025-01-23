import { ICollaborativeDrive } from '@jupyter/collaborative-drive';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { JupyterGISWidget } from '@jupytergis/base';
import { JupyterGISModel, IJupyterGISDoc } from '@jupytergis/schema';

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { Contents } from '@jupyterlab/services';
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
    model: JupyterGISModel,
    docManager: IDocumentManager,
  }) {
    super();

    const path: String = "espm-157/debug.jgis";
    const widget = options.docManager.open(`RTC:${path}`);
    if (widget instanceof JupyterGISWidget) {
      this._jgisWidget = widget;
      this.addWidget(this._jgisWidget);
      this._jgisWidget.show();
    }

    this.addClass(CLASS_NAME);
  }

  onResize = (): void => {
    if (this._jgisWidget) {
      MessageLoop.sendMessage(
        this._jgisWidget,
        Widget.ResizeMessage.UnknownSize
      );
    }
  };

  private _jgisWidget: JupyterGISWidget;
}

// TODO: Typo
export const notebookRenderePlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytergis:yjswidget-plugin',
  autoStart: true,
  requires: [IDocumentManager],
  optional: [IJupyterYWidgetManager, ICollaborativeDrive],
  activate: (
    app: JupyterFrontEnd,
    docManager: IDocumentManager,
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

        return this.jupyterGISModel.sharedModel.ydoc;
      }
    }

    class YJupyterGISWidget implements IJupyterYWidget {
      constructor(yModel: YJupyterGISModel, node: HTMLElement) {
        this.yModel = yModel;
        this.node = node;

        const widget = new YJupyterGISLuminoWidget({
          model: yModel.jupyterGISModel,
          docManager,
        });
        // Widget.attach(widget, node);

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
