import { IStateDB } from '@jupyterlab/statedb';
import { ReactWidget } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import * as React from 'react';

import { MainView } from './mainView';
import { MainViewModel } from './mainviewmodel';

export class JupyterGISMainViewPanel extends ReactWidget {
  /**
   * Construct a `JupyterGISPanel`.
   */
  constructor(
    options: { mainViewModel: MainViewModel, state?: IStateDB },
    rightPanel?: Widget,
  ) {
    super();
    this._mainViewModel = options.mainViewModel;
    this._state = options.state;
    this.addClass('jp-jupytergis-panel');
    this._rightPanel = rightPanel;
  }

  render(): JSX.Element {
    return (
      <MainView
        state={this._state}
        rightPanel={this._rightPanel}
        viewModel={this._mainViewModel}
      />
    );
  }

  private _state?: IStateDB;
  private _mainViewModel: MainViewModel;
  private _rightPanel?: Widget;
}
