import {
  IAnnotation,
  IJGISLayerDocChange,
  IJupyterGISDoc,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { ObservableMap } from '@jupyterlab/observables';
import { CommandRegistry } from '@lumino/commands';
import { JSONValue } from '@lumino/coreutils';
import { IDisposable } from '@lumino/disposable';
import { v4 as uuid } from 'uuid';

export class MainViewModel implements IDisposable {
  constructor(options: MainViewModel.IOptions) {
    this._jGISModel = options.jGISModel;
    this._viewSetting = options.viewSetting;
    this._commands = options.commands;
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

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._jGISModel.sharedLayersChanged.disconnect(
      this._onsharedLayersChanged,
      this,
    );
    this._isDisposed = true;
  }

  initSignal(): void {
    this._jGISModel.sharedLayersChanged.connect(
      this._onsharedLayersChanged,
      this,
    );
  }

  addAnnotation(value: IAnnotation): void {
    this._jGISModel.annotationModel?.addAnnotation(uuid(), value);
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
