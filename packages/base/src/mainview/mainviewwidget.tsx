import { IAnnotationModel, IJGISFormSchemaRegistry } from '@jupytergis/schema';
import { ReactWidget } from '@jupyterlab/apputils';
import type { ILoggerRegistry } from '@jupyterlab/logconsole';
import { IStateDB } from '@jupyterlab/statedb';
import * as React from 'react';

import { MainViewWithMediaQuery } from './mainView';
import { MainViewModel } from './mainviewmodel';

export interface IOptions {
  mainViewModel: MainViewModel;
  state?: IStateDB;
  formSchemaRegistry?: IJGISFormSchemaRegistry;
  annotationModel?: IAnnotationModel;
  loggerRegistry?: ILoggerRegistry;
}

export type LayerDataProvider = (layerId: string) => Record<string, unknown>[];

export class JupyterGISMainViewPanel extends ReactWidget {
  constructor(options: IOptions) {
    super();
    this._state = options.state;
    this.addClass('jp-jupytergis-panel');
    this._options = options;
  }

  setDataProvider(provider: LayerDataProvider): void {
    this._dataProvider = provider;
  }

  getLayerFeatureData(layerId: string): Record<string, unknown>[] {
    return this._dataProvider?.(layerId) ?? [];
  }

  render(): JSX.Element {
    return (
      <MainViewWithMediaQuery
        state={this._state}
        viewModel={this._options.mainViewModel}
        formSchemaRegistry={this._options.formSchemaRegistry}
        annotationModel={this._options.annotationModel}
        loggerRegistry={this._options.loggerRegistry}
        setDataProvider={fn => this.setDataProvider(fn)}
      />
    );
  }

  private _state?: IStateDB;
  private _options: IOptions;
  private _dataProvider?: LayerDataProvider;
}
