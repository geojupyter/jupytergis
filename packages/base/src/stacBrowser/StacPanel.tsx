import { IJupyterGISTracker } from '@jupytergis/schema';
import { ReactWidget } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import React from 'react';
import { IControlPanelModel } from '../types';
import StacBrowser from './StacBrowser';

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
        <StacBrowser
          controlPanelModel={this._model}
          tracker={this._tracker}
          display="side"
        ></StacBrowser>
      )
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
