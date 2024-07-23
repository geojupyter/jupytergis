import { JupyterGISDoc, IJupyterGISTracker } from '@jupytergis/schema';
import { SidePanel } from '@jupyterlab/ui-components';

import { IControlPanelModel } from '../types';
import { LayersPanel } from './components/layers';
import { SourcesPanel } from './components/sources';
import { ControlPanelHeader } from './header';

export class LeftPanelWidget extends SidePanel {
  constructor(options: LeftPanelWidget.IOptions) {
    super();
    this.addClass('jGIS-sidepanel-widget');
    this._model = options.model;
    const header = new ControlPanelHeader();
    this.header.addWidget(header);

    const sourcesPanel = new SourcesPanel({ model: this._model });
    sourcesPanel.title.caption = 'Sources';
    sourcesPanel.title.label = 'Sources';
    this.addWidget(sourcesPanel);

    const layerTree = new LayersPanel({ model: this._model });
    layerTree.title.caption = 'Layer tree';
    layerTree.title.label = 'Layers';
    this.addWidget(layerTree);

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
