import { IJupyterGISTracker } from '@jupytergis/schema';
import { ReactWidget } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import React from 'react';

import StacBrowser from '@/src/stacBrowser/StacBrowser';
import { IControlPanelModel } from '@/src/types';

export class StacPanel extends Panel {
  constructor(options: StacPanel.IOptions) {
    super();
    this._model = options.model;
    this._tracker = options.tracker;

    this.id = 'jupytergis::stacPanel';
    this.title.caption = 'STAC';
    this.title.label = 'STAC';
    this.addClass('jgis-scrollable');

    this.addWidget(
      ReactWidget.create(
        <StacBrowser controlPanelModel={this._model}></StacBrowser>,
      ),
    );
  }

  private _model: IControlPanelModel | undefined;
  private _tracker: IJupyterGISTracker;
}

export namespace StacPanel {
  export interface IOptions {
    model: IControlPanelModel;
    tracker: IJupyterGISTracker;
  }
}

export default StacPanel;
