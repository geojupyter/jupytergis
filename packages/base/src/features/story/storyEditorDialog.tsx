import { IJGISFormSchemaRegistry, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import type { IEditorServices } from '@jupyterlab/codeeditor';
import type { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import React from 'react';

import { StoryRenderMimeProvider } from '@/src/features/story/components/StoryRenderMime';

import { StoryEditorDialogBody } from './StoryEditorDialogBody';
import { StoryEditorSession } from './storyEditorSession';

export interface IStoryEditorWidgetOptions {
  model: IJupyterGISModel;
  commands: CommandRegistry;
  state: IStateDB;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  editorServices: IEditorServices;
  rendermime: IRenderMimeRegistry;
}

export class StoryEditorWidget extends Dialog<boolean> {
  readonly model: IJupyterGISModel;

  constructor(options: IStoryEditorWidgetOptions) {
    const body = (
      <StoryRenderMimeProvider
        rendermime={options.rendermime}
        model={options.model}
      >
        <StoryEditorDialogBody
          model={options.model}
          commands={options.commands}
          state={options.state}
          formSchemaRegistry={options.formSchemaRegistry}
          editorServices={options.editorServices}
        />
      </StoryRenderMimeProvider>
    );

    super({
      title: 'Story Editor',
      body,
      buttons: [],
    });

    this.model = options.model;
    this.id = 'jupytergis::storyEditor';
    this.addClass('jgis-story-editor-dialog');
  }

  // Prevent Jupyter Dialog from from eating key presses
  protected _evtKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === 'Escape') {
      return;
    }

    super._evtKeydown(event);
  }

  dispose(): void {
    StoryEditorSession.getInstance().onDialogDisposed(this.model);
    super.dispose();
  }
}
