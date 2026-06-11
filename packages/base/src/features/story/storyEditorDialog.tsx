import {
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import React from 'react';

import { StoryEditorDialogBodyDraft } from './StoryEditorDialogBodyDraft';

export interface IStoryEditorWidgetOptions {
  model: IJupyterGISModel;
  commands: CommandRegistry;
  state: IStateDB;
  formSchemaRegistry: IJGISFormSchemaRegistry;
}

export class StoryEditorWidget extends Dialog<boolean> {
  constructor(options: IStoryEditorWidgetOptions) {
    const body = (
      <StoryEditorDialogBodyDraft
        model={options.model}
        commands={options.commands}
        state={options.state}
        formSchemaRegistry={options.formSchemaRegistry}
      />
    );

    super({
      title: 'Story Editor',
      body,
      buttons: [Dialog.cancelButton(), Dialog.okButton()],
    });

    this.id = 'jupytergis::storyEditor';
    this.addClass('jgis-story-editor-dialog');
  }
}
