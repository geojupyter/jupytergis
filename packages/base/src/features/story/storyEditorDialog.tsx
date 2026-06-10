import { IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { CommandRegistry } from '@lumino/commands';
import React from 'react';

import StoryEditorPanel from './StoryEditorPanel';

export interface IStoryEditorWidgetOptions {
  model: IJupyterGISModel;
  commands: CommandRegistry;
}

export class StoryEditorWidget extends Dialog<boolean> {
  constructor(options: IStoryEditorWidgetOptions) {
    const body = (
      <StoryEditorPanel model={options.model} commands={options.commands} />
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
