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

import { CommandIDs } from '../commands';
import { UsersItem } from './usertoolbaritem';
import * as React from 'react';

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

      this.addItem(
        'newRasterLayer',
        new CommandToolbarButton({
          id: CommandIDs.newRasterLayer,
          label: '',
          commands: options.commands
        })
      );

      // Add more commands here

      this.addItem('spacer', Toolbar.createSpacerItem());

      // Users
      this.addItem(
        'users',
        ReactWidget.create(<UsersItem model={options.model} />)
      );
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
