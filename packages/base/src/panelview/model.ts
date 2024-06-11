import {
  IJupyterGISDoc,
  IJupyterGISModel,
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

  get documentChanged(): ISignal<IJupyterGISTracker, IJupyterGISWidget | null> {
    return this._documentChanged;
  }

  get filePath(): string | undefined {
    return this._tracker.currentWidget?.context.localPath;
  }

  get jGISModel(): IJupyterGISModel | undefined {
    return this._tracker.currentWidget?.context.model;
  }

  get sharedModel(): IJupyterGISDoc | undefined {
    return this._tracker.currentWidget?.context.model.sharedModel;
  }

  disconnect(f: any): void {
    this._tracker.forEach(w => {
      w.context.model.sharedLayersChanged.disconnect(f);
      w.context.model.sharedOptionsChanged.disconnect(f);
      w.context.model.sharedMetadataChanged.disconnect(f);
    });
    this._tracker.forEach(w => w.context.model.themeChanged.disconnect(f));
    this._tracker.forEach(w =>
      w.context.model.clientStateChanged.disconnect(f)
    );
  }

  private readonly _tracker: IJupyterGISTracker;
  private _documentChanged: ISignal<
    IJupyterGISTracker,
    IJupyterGISWidget | null
  >;
}

namespace ControlPanelModel {
  export interface IOptions {
    tracker: IJupyterGISTracker;
  }
}
