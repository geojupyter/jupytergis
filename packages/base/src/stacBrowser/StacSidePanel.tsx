import { IJupyterGISTracker } from '@jupytergis/schema';
import { SidePanel } from '@jupyterlab/ui-components';
import { IControlPanelModel } from '../types';
import StacPanel from './StacPanel';

export class StacSidePanel extends SidePanel {
  constructor(options: StacRightPanel.IOptions) {
    super();
    this.addClass('jGIS-sidepanel-widget');
    this.addClass('data-jgis-keybinding');
    this.node.tabIndex = 1;

    this._model = options.model;
    this._tracker = options.tracker;

    // const identifyPanel = new IdentifyPanel({
    //   model: this._model,
    //   tracker: options.tracker
    // });

    console.log('adding stac panel');

    const stac = new StacPanel({
      model: this._model,
      tracker: this._tracker
    });

    this.addWidget(stac);
  }

  dispose(): void {
    super.dispose();
  }

  private _model: IControlPanelModel | null;
  private _tracker: IJupyterGISTracker;
}

export namespace StacRightPanel {
  export interface IOptions {
    model: IControlPanelModel;
    tracker: IJupyterGISTracker;
  }
}
