import {
  IAnnotation,
  IJGISLayerDocChange,
  IJupyterGISDoc,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { ObservableMap } from '@jupyterlab/observables';
import { CommandRegistry } from '@lumino/commands';
import { JSONValue, UUID } from '@lumino/coreutils';
import { IDisposable } from '@lumino/disposable';

import { IssTracker } from '../features/layers/iss';

export class MainViewModel implements IDisposable {
  constructor(options: MainViewModel.IOptions) {
    this._jGISModel = options.jGISModel;
    this._viewSetting = options.viewSetting;
    this._commands = options.commands;
    this._issTracker = new IssTracker(options.jGISModel);
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get id(): string {
    return this._id;
  }

  get jGISModel() {
    return this._jGISModel;
  }

  get viewSettingChanged() {
    return this._viewSetting.changed;
  }

  get commands(): CommandRegistry {
    return this._commands;
  }

  get issTracker(): IssTracker {
    return this._issTracker;
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._jGISModel.sharedLayersChanged.disconnect(
      this._onsharedLayersChanged,
      this,
    );
    this._issTracker.dispose();
    this._isDisposed = true;
  }

  initSignal(): void {
    this._jGISModel.sharedLayersChanged.connect(
      this._onsharedLayersChanged,
      this,
    );
    this._issTracker.connect();
    this._issTracker.syncFromModel();
  }

  addAnnotation(value: IAnnotation): void {
    this._jGISModel.annotationModel?.addAnnotation(UUID.uuid4(), value);
  }

  private async _onsharedLayersChanged(
    _: IJupyterGISDoc,
    change: IJGISLayerDocChange,
  ): Promise<void> {
    if (change.layerChange) {
      // TODO STUFF with the new updated shared model
    }
  }

  private _jGISModel: IJupyterGISModel;
  private _viewSetting: ObservableMap<JSONValue>;
  private _commands: CommandRegistry;
  private _issTracker: IssTracker;
  private _id: string;
  private _isDisposed = false;
}

export namespace MainViewModel {
  export interface IOptions {
    jGISModel: IJupyterGISModel;
    viewSetting: ObservableMap<JSONValue>;
    commands: CommandRegistry;
  }
}
