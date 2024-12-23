import { IJupyterGISTracker } from '@jupytergis/schema';
import { ReactWidget } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import React from 'react';
import { IControlPanelModel } from '../../../types';

export class IdentifyPanel extends Panel {
  constructor(options: IdentifyPanel.IOptions) {
    super();
    this._model = options.model;
    this._tracker = options.tracker;

    this.id = 'jupytergis::identifyPanel';
    this.title.caption = 'Identify';
    this.title.label = 'Identify';
    // this.addClass(LAYERS_PANEL_CLASS);

    this.addWidget(
      ReactWidget.create(
        <IdentifyPanelComponent
          model={this._model}
          tracker={this._tracker}
        ></IdentifyPanelComponent>
      )
    );
  }

  private _model: IControlPanelModel | undefined;
  private _tracker: IJupyterGISTracker;
}

export namespace IdentifyPanel {
  export interface IOptions {
    model: IControlPanelModel;
    tracker: IJupyterGISTracker;
  }
}

interface IIdentifyComponentProps {
  model: IControlPanelModel;
  tracker: IJupyterGISTracker;
}

const IdentifyPanelComponent = ({
  model,
  tracker
}: IIdentifyComponentProps) => {
  return <div>IdentifyPanel</div>;
};

export default IdentifyPanel;
