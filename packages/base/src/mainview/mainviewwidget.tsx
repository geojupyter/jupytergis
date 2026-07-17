import { IAnnotationModel, IJGISFormSchemaRegistry } from '@jupytergis/schema';
import { ReactWidget } from '@jupyterlab/apputils';
import type { ILoggerRegistry } from '@jupyterlab/logconsole';
import type {
  IRenderMimeRegistry,
  IUrlResolverFactory,
} from '@jupyterlab/rendermime';
import { IStateDB } from '@jupyterlab/statedb';
import * as React from 'react';

import { StoryRenderMimeProvider } from '@/src/features/story/components/StoryRenderMime';
import { MainViewWithObserver } from '@/src/mainview/mainView';
import { MainViewModel } from '@/src/mainview/mainviewmodel';

export interface IOptions {
  mainViewModel: MainViewModel;
  rendermime: IRenderMimeRegistry;
  urlResolverFactory?: IUrlResolverFactory;
  state?: IStateDB;
  formSchemaRegistry?: IJGISFormSchemaRegistry;
  annotationModel?: IAnnotationModel;
  loggerRegistry?: ILoggerRegistry;
}

export class JupyterGISMainViewPanel extends ReactWidget {
  /**
   * Construct a `JupyterGISPanel`.
   */
  constructor(options: IOptions) {
    super();

    this._state = options.state;
    this._options = options;
    this._rendermime = options.rendermime;
    this._urlResolverFactory = options.urlResolverFactory;

    this.addClass('jp-jupytergis-panel');
  }

  render(): JSX.Element {
    return (
      <StoryRenderMimeProvider
        rendermime={this._rendermime}
        model={this._options.mainViewModel.jGISModel}
        urlResolverFactory={this._urlResolverFactory}
      >
        <MainViewWithObserver
          state={this._state}
          viewModel={this._options.mainViewModel}
          formSchemaRegistry={this._options.formSchemaRegistry}
          annotationModel={this._options.annotationModel}
          loggerRegistry={this._options.loggerRegistry}
        />
      </StoryRenderMimeProvider>
    );
  }

  private _state?: IStateDB;
  private _options: IOptions;
  private _rendermime: IRenderMimeRegistry;
  private _urlResolverFactory?: IUrlResolverFactory;
}
