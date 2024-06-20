import { IJupyterGISModel, IJupyterGISWidget } from '@jupytergis/schema';
import { ReactWidget } from '@jupyterlab/apputils';
import { DocumentWidget } from '@jupyterlab/docregistry';
import { IObservableMap, ObservableMap } from '@jupyterlab/observables';
import { JSONValue } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import * as React from 'react';

import { MainView } from './mainview';
import { MainViewModel } from './mainview/mainviewmodel';

export class JupyterGISWidget
  extends DocumentWidget<JupyterGISPanel, IJupyterGISModel>
  implements IJupyterGISWidget
{
  constructor(
    options: DocumentWidget.IOptions<JupyterGISPanel, IJupyterGISModel>
  ) {
    super(options);
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    this.content.dispose();
    super.dispose();
  }

  onResize = (msg: any): void => {
    window.dispatchEvent(new Event('resize'));
  };
}

export class JupyterGISPanel extends ReactWidget {
  /**
   * Construct a `JupyterGISPanel`.
   *
   * @param context - The documents context.
   */
  constructor(options: { model: IJupyterGISModel }) {
    super();
    this.addClass('jp-jupytergis-panel');
    this._view = new ObservableMap<JSONValue>();
    this._mainViewModel = new MainViewModel({
      jGISModel: options.model,
      viewSetting: this._view
    });
  }

  get viewChanged(): ISignal<
    ObservableMap<JSONValue>,
    IObservableMap.IChangedArgs<JSONValue>
  > {
    return this._view.changed;
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    Signal.clearData(this);
    this._mainViewModel.dispose();
    super.dispose();
  }

  get currentViewModel(): MainViewModel {
    return this._mainViewModel;
  }

  deleteAxes(): void {
    this._view.delete('axes');
  }

  render(): JSX.Element {
    return <MainView viewModel={this._mainViewModel} />;
  }

  private _mainViewModel: MainViewModel;
  private _view: ObservableMap<JSONValue>;
}
