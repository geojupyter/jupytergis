import { IJGISFormSchemaRegistry, IJupyterGISModel } from '@jupytergis/schema';
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
}

export class StoryEditorWidget extends Dialog<boolean> {
  constructor(options: IStoryEditorWidgetOptions) {
    const body = (
      <StoryEditorDialogBody
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

  minimize(): void {
    this.addClass('jgis-story-editor-dialog--minimized');
    this.hide();
  }

  restore(): void {
    this.removeClass('jgis-story-editor-dialog--minimized');
    this.show();
    this.activate();
  }

  // Prevent Jupyter Dialog from from eating enter key presses
  protected _evtKeydown(event: KeyboardEvent): void {
    if (
      event.key === 'Enter' &&
      document.activeElement instanceof HTMLTextAreaElement
    ) {
      return;
    }

    super._evtKeydown(event);
  }

  dispose(): void {
    StoryEditorSession.getInstance().clear();
    super.dispose();
  }
}
