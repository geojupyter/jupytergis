import { IAnnotationModel, IJGISFormSchemaRegistry } from '@jupytergis/schema';
import { ReactWidget } from '@jupyterlab/apputils';
import type { ILoggerRegistry } from '@jupyterlab/logconsole';
import type { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { IStateDB } from '@jupyterlab/statedb';
import * as React from 'react';

import { StoryRenderMimeProvider } from '@/src/features/story/components/ListStoryOverlayMarkdown';
import { MainViewWithMediaQuery } from '@/src/mainview/mainView';
import { MainViewModel } from '@/src/mainview/mainviewmodel';

export interface IOptions {
  mainViewModel: MainViewModel;
  state?: IStateDB;
  formSchemaRegistry?: IJGISFormSchemaRegistry;
  annotationModel?: IAnnotationModel;
  loggerRegistry?: ILoggerRegistry;
  notebookTracker?: { currentWidget: { content: any } | null };
  rendermime?: IRenderMimeRegistry | null;
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
      <StoryRenderMimeProvider rendermime={this._options.rendermime}>
        <MainViewWithMediaQuery
          state={this._state}
          viewModel={this._options.mainViewModel}
          formSchemaRegistry={this._options.formSchemaRegistry}
          annotationModel={this._options.annotationModel}
          loggerRegistry={this._options.loggerRegistry}
          notebookTracker={this._options.notebookTracker}
        />
      </StoryRenderMimeProvider>
    );
  }

  private _state?: IStateDB;
  private _options: IOptions;
}
