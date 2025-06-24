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
    options: { mainViewModel: MainViewModel },
    leftPanel?: Widget,
    rightPanel?: Widget,
  ) {
    super();
    this._mainViewModel = options.mainViewModel;
    this.addClass('jp-jupytergis-panel');
    this._leftPanel = leftPanel;
    this._rightPanel = rightPanel;
  }

  render(): JSX.Element {
    return (
      <MainView
        leftPanel={this._leftPanel}
        rightPanel={this._rightPanel}
        viewModel={this._mainViewModel}
      />
    );
  }

  private _mainViewModel: MainViewModel;
  private _leftPanel?: Widget;
  private _rightPanel?: Widget;
}
