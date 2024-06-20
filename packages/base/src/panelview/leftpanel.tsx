import { JupyterGISDoc, IJupyterGISTracker } from '@jupytergis/schema';
import { SidePanel } from '@jupyterlab/ui-components';

import { IControlPanelModel } from '../types';
import { ControlPanelHeader } from './header';

export class LeftPanelWidget extends SidePanel {
  constructor(options: LeftPanelWidget.IOptions) {
    super();
    this.addClass('jGIS-sidepanel-widget');
    this._model = options.model;
    const header = new ControlPanelHeader();
    this.header.addWidget(header);

    console.log(this._model);
    // const datasources = new DataSourceList({ controlPanelModel: this._model });
    // this.addWidget(datasources);

    // const layersList = new LayersList({ controlPanelModel: this._model });
    // this.addWidget(layersList);

    options.tracker.currentChanged.connect((_, changed) => {
      if (changed) {
        header.title.label = changed.context.localPath;
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

export namespace LeftPanelWidget {
  export interface IOptions {
    model: IControlPanelModel;
    tracker: IJupyterGISTracker;
  }

  export interface IProps {
    filePath?: string;
    sharedModel?: JupyterGISDoc;
  }
}
