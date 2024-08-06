import {
  IJGISFormSchemaRegistry,
  IJupyterGISTracker,
  JupyterGISDoc
} from '@jupytergis/schema';
import { SidePanel } from '@jupyterlab/ui-components';

import { IControlPanelModel } from '../types';
import { FilterPanel } from './components/Filter';
import { ControlPanelHeader } from './header';
import { ObjectProperties } from './objectproperties';

export class RightPanelWidget extends SidePanel {
  constructor(options: RightPanelWidget.IOptions) {
    super();
    this.addClass('jGIS-sidepanel-widget');
    this._model = options.model;
    const header = new ControlPanelHeader();
    this.header.addWidget(header);
    const properties = new ObjectProperties({
      controlPanelModel: this._model,
      formSchemaRegistry: options.formSchemaRegistry,
      tracker: options.tracker
    });

    this.addWidget(properties);

    const filterPanel = new FilterPanel({
      model: this._model,
      tracker: options.tracker,
      formSchemaRegistry: options.formSchemaRegistry
    });

    filterPanel.title.caption = 'Filters';
    filterPanel.title.label = 'Filters';
    this.addWidget(filterPanel);

    this._model.documentChanged.connect((_, changed) => {
      if (changed) {
        if (changed.context.model.sharedModel.editable) {
          header.title.label = changed.context.localPath;
          properties.show();
        } else {
          header.title.label = `${changed.context.localPath} - Read Only`;
          properties.hide();
        }
      } else {
        header.title.label = '-';
      }
    });
  }

  dispose(): void {
    super.dispose();
  }

  private _model: IControlPanelModel;
}

export namespace RightPanelWidget {
  export interface IOptions {
    model: IControlPanelModel;
    tracker: IJupyterGISTracker;
    formSchemaRegistry: IJGISFormSchemaRegistry;
  }
  export interface IProps {
    filePath?: string;
    sharedModel?: JupyterGISDoc;
  }
}
