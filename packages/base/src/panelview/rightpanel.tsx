import {
  IAnnotationModel,
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
  JupyterGISDoc,
} from '@jupytergis/schema';
import { SidePanel } from '@jupyterlab/ui-components';

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
      formSchemaRegistry: options.formSchemaRegistry,
      model: options.model,
    });

    this.addWidget(properties);

    const annotations = new Annotations({
      rightPanelModel: this._model,
      annotationModel: this._annotationModel,
    });
    this.addWidget(annotations);

    const identifyPanel = new IdentifyPanel({
      model: this._model,
    });
    identifyPanel.title.caption = 'Identify';
    identifyPanel.title.label = 'Identify';
    identifyPanel.addClass('jgis-scrollable');
    this.addWidget(identifyPanel);
  }

  dispose(): void {
    super.dispose();
  }

  private _model: IJupyterGISModel;
  private _annotationModel: IAnnotationModel;
}

export namespace RightPanelWidget {
  export interface IOptions {
    formSchemaRegistry: IJGISFormSchemaRegistry;
    annotationModel: IAnnotationModel;
    model: IJupyterGISModel;
  }
  export interface IProps {
    filePath?: string;
    sharedModel?: JupyterGISDoc;
  }
}
