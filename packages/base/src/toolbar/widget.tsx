import { IJGISExternalCommand, JupyterGISModel } from '@jupytergis/schema';
import { CommandToolbarButton } from '@jupyterlab/apputils';
import {
  ReactWidget,
  redoIcon,
  Toolbar,
  undoIcon
} from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { Widget } from '@lumino/widgets';
import * as React from 'react';

import { CommandIDs } from '../commands';
import { UsersItem } from './usertoolbaritem';

export const TOOLBAR_SEPARATOR_CLASS = 'jGIS-Toolbar-Separator';

export class Separator extends Widget {
  /**
   * Construct a new separator widget.
   */
  constructor() {
    super();
    this.addClass(TOOLBAR_SEPARATOR_CLASS);
  }
}

export class ToolbarWidget extends Toolbar {
  constructor(options: ToolbarWidget.IOptions) {
    super(options);

    this.addClass('jGIS-toolbar-widget');

    if (options.commands) {
      this.addItem(
        'undo',
        new CommandToolbarButton({
          id: CommandIDs.undo,
          label: '',
          icon: undoIcon,
          commands: options.commands
        })
      );

      this.addItem(
        'redo',
        new CommandToolbarButton({
          id: CommandIDs.redo,
          label: '',
          icon: redoIcon,
          commands: options.commands
        })
      );

      this.addItem('separator1', new Separator());

      // Add more commands here
    }
  }
}

export namespace ToolbarWidget {
  export interface IOptions extends Toolbar.IOptions {
    commands?: CommandRegistry;
    model: JupyterGISModel;
    externalCommands: IJGISExternalCommand[];
  }
}
