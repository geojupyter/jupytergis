import { IJGISFormSchemaRegistry, IJupyterGISModel } from '@jupytergis/schema';
import type { IEditorServices } from '@jupyterlab/codeeditor';
import { Dialog } from '@jupyterlab/apputils';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import React from 'react';

import { StoryEditorDialogBody } from './StoryEditorDialogBody';
import { StoryEditorSession } from './storyEditorSession';

export interface IStoryEditorWidgetOptions {
  model: IJupyterGISModel;
  commands: CommandRegistry;
  state: IStateDB;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  editorServices: IEditorServices;
}

export class StoryEditorWidget extends Dialog<boolean> {
  readonly model: IJupyterGISModel;

  constructor(options: IStoryEditorWidgetOptions) {
    const body = (
      <StoryEditorDialogBody
        model={options.model}
        commands={options.commands}
        state={options.state}
        formSchemaRegistry={options.formSchemaRegistry}
        editorServices={options.editorServices}
      />
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

  // Prevent Jupyter Dialog from from eating enter key presses
  protected _evtKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      const active = document.activeElement;
      if (active?.closest('.cm-editor')) {
        return;
      }
    }

    super._evtKeydown(event);
  }

  dispose(): void {
    StoryEditorSession.getInstance().onDialogDisposed(this.model);
    super.dispose();
  }
}
