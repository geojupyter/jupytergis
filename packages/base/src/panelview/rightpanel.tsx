import {
  IAnnotationModel,
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
  IJupyterGISTracker,
  JupyterGISDoc
} from '@jupytergis/schema';
import { SidePanel } from '@jupyterlab/ui-components';

import { IControlPanelModel } from '@/src/types';
import { Annotations } from './annotationPanel';
import IdentifyPanel from './components/identify-panel/IdentifyPanel';
import { ControlPanelHeader } from './header';
import { ObjectProperties } from './objectproperties';

export class RightPanelWidget extends SidePanel {
  constructor(options: RightPanelWidget.IOptions) {
    super();
    this.addClass('jGIS-sidepanel-widget');
    this.addClass('data-jgis-keybinding');
    this.node.tabIndex = 0;

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
    identifyPanel.addClass('jgis-scrollable');
    this.addWidget(identifyPanel);

    this._model.documentChanged.connect((_, changed) => {
      if (changed) {
        if (changed.model.sharedModel.editable) {
          header.title.label = changed.model.filePath;
          properties.show();
        } else {
          header.title.label = `${changed.model.filePath} - Read Only`;
          properties.hide();
        }
      } else {
        header.title.label = '-';
      }
    });

    options.tracker.currentChanged.connect(async (_, changed) => {
      if (changed) {
        this._currentModel = changed.model;
        header.title.label = this._currentModel.filePath;
        this._annotationModel.model =
          options.tracker.currentWidget?.model || undefined;
        // await changed.context.ready;
      } else {
        header.title.label = '-';
        this._currentModel = null;
        this._annotationModel.model = undefined;
      }
    });
  }

  dispose(): void {
    super.dispose();
  }

  private _currentModel: IJupyterGISModel | null;
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
