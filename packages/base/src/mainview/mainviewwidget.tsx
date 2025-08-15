import { IAnnotationModel, IJGISFormSchemaRegistry } from '@jupytergis/schema';
import { ReactWidget } from '@jupyterlab/apputils';
import { IStateDB } from '@jupyterlab/statedb';
import * as React from 'react';

import { MainView } from './mainView';
import { MainViewModel } from './mainviewmodel';

export interface IOptions {
  mainViewModel: MainViewModel;
  state?: IStateDB;
  formSchemaRegistry?: IJGISFormSchemaRegistry;
  annotationModel?: IAnnotationModel;
}

export class JupyterGISMainViewPanel extends ReactWidget {
  /**
   * Construct a `JupyterGISPanel`.
   */
  constructor(options: IOptions) {
    super();
    this._state = options.state;
    this.addClass('jp-jupytergis-panel');
    this._options = options;
  }

  render(): JSX.Element {
    return (
      <MainView
        state={this._state}
        viewModel={this._options.mainViewModel}
        formSchemaRegistry={this._options.formSchemaRegistry}
        annotationModel={this._options.annotationModel}
      />
    );
  }

  private _state?: IStateDB;
  private _options: IOptions;
}
