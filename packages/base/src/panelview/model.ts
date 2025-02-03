import {
  IJupyterGISDoc,
  IJupyterGISModel,
  IJupyterGISOutputWidget,
  IJupyterGISTracker,
  IJupyterGISWidget
} from '@jupytergis/schema';
import { ISignal } from '@lumino/signaling';

import { IControlPanelModel } from '../types';

export class ControlPanelModel implements IControlPanelModel {
  constructor(options: ControlPanelModel.IOptions) {
    this._tracker = options.tracker;
    this._documentChanged = this._tracker.currentChanged;
  }

  get documentChanged(): ISignal<
    IJupyterGISTracker,
    IJupyterGISWidget | IJupyterGISOutputWidget | null
  > {
    return this._documentChanged;
  }

  get filePath(): string | undefined {
    return this._tracker.currentWidget?.model.filePath;
  }

  get jGISModel(): IJupyterGISModel | undefined {
    return this._tracker.currentWidget?.model;
  }

  get sharedModel(): IJupyterGISDoc | undefined {
    return this._tracker.currentWidget?.model.sharedModel;
  }

  disconnect(f: any): void {
    this._tracker.forEach(w => {
      w.model.sharedLayersChanged.disconnect(f);
      w.model.sharedSourcesChanged.disconnect(f);
      w.model.sharedOptionsChanged.disconnect(f);
    });
    this._tracker.forEach(w => w.model.themeChanged.disconnect(f));
    this._tracker.forEach(w =>
      w.model.clientStateChanged.disconnect(f)
    );
  }

  private readonly _tracker: IJupyterGISTracker;
  private _documentChanged: ISignal<
    IJupyterGISTracker,
    IJupyterGISWidget | IJupyterGISOutputWidget | null
  >;
}

namespace ControlPanelModel {
  export interface IOptions {
    tracker: IJupyterGISTracker;
  }
}
