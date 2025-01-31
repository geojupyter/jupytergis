import {
  IAnnotationModel,
  IJGISFormSchemaRegistry,
  IJupyterGISTracker,
  IJupyterGISWidgetContext,
  JupyterGISDoc
} from '@jupytergis/schema';
import { SidePanel } from '@jupyterlab/ui-components';

import { IControlPanelModel } from '../types';
import { ControlPanelHeader } from './header';
import { ObjectProperties } from './objectproperties';
import { Annotations } from './annotationPanel';
import IdentifyPanel from './components/identify-panel/IdentifyPanel';

export class RightPanelWidget extends SidePanel {
  constructor(options: RightPanelWidget.IOptions) {
    super();
    this.addClass('jGIS-sidepanel-widget');

    this._model = options.model;
    this._annotationModel = options.annotationModel;

    const header = new ControlPanelHeader();
    this.header.addWidget(header);
    const properties = new ObjectProperties({
      controlPanelModel: this._model,
      formSchemaRegistry: options.formSchemaRegistry,
      tracker: options.tracker
    });

    this.addWidget(properties);

    const annotations = new Annotations({
      rightPanelModel: this._model,
      annotationModel: this._annotationModel
    });
    this.addWidget(annotations);

    const identifyPanel = new IdentifyPanel({
      model: this._model,
      tracker: options.tracker
    });
    identifyPanel.title.caption = 'Identify';
    identifyPanel.title.label = 'Identify';
    this.addWidget(identifyPanel);

    this._model.documentChanged.connect((_, changed) => {
      if (changed) {
        if (changed.context.model.sharedModel.editable) {
          header.title.label = changed.context.path;
          properties.show();
        } else {
          header.title.label = `${changed.context.path} - Read Only`;
          properties.hide();
        }
      } else {
        header.title.label = '-';
      }
    });

    options.tracker.currentChanged.connect(async (_, changed) => {
      if (changed) {
        this._currentContext = changed.context;
        header.title.label = this._currentContext.path;
        this._annotationModel.context =
          options.tracker.currentWidget?.context || undefined;
        // await changed.context.ready;
      } else {
        header.title.label = '-';
        this._currentContext = null;
        this._annotationModel.context = undefined;
      }
    });
  }

  dispose(): void {
    super.dispose();
  }

  private _currentContext: IJupyterGISWidgetContext | null;
  private _model: IControlPanelModel;
  private _annotationModel: IAnnotationModel;
}

export namespace RightPanelWidget {
  export interface IOptions {
    model: IControlPanelModel;
    tracker: IJupyterGISTracker;
    formSchemaRegistry: IJGISFormSchemaRegistry;
    annotationModel: IAnnotationModel;
  }
  export interface IProps {
    filePath?: string;
    sharedModel?: JupyterGISDoc;
  }
}
