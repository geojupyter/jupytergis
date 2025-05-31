import { ReactWidget } from '@jupyterlab/apputils';
import * as React from 'react';

import { MainView } from './mainView';
import { MainViewModel } from './mainviewmodel';

export class JupyterGISMainViewPanel extends ReactWidget {
  /**
   * Construct a `JupyterGISPanel`.
   */
  constructor(options: { mainViewModel: MainViewModel }) {
    super();
    this._mainViewModel = options.mainViewModel;
    this.addClass('jp-jupytergis-panel');
  }

  render(): JSX.Element {
    return <MainView viewModel={this._mainViewModel} />;
  }

  private _mainViewModel: MainViewModel;
}
