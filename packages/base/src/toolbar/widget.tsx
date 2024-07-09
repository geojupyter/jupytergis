import { IJGISExternalCommand, JupyterGISModel } from '@jupytergis/schema';
import { CommandToolbarButton } from '@jupyterlab/apputils';
import {
  ReactWidget,
  Toolbar,
  redoIcon,
  undoIcon
} from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { Widget } from '@lumino/widgets';

import * as React from 'react';
import { CommandIDs } from '../commands';
import { UsersItem } from './usertoolbaritem';

export const TOOLBAR_SEPARATOR_CLASS = 'jGIS-Toolbar-Separator';
export const TOOLBAR_GROUPNAME_CLASS = 'jGIS-Toolbar-GroupName';

export class Separator extends Widget {
  /**
   * Construct a new separator widget.
   */
  constructor() {
    super();
    this.addClass(TOOLBAR_SEPARATOR_CLASS);
  }
}

export class GroupName extends Widget {
  /**
   * Construct a new group name widget.
   */
  constructor(options: { name: string }) {
    const span = document.createElement('span');
    span.textContent = options.name;
    super({ node: span });
    this.addClass(TOOLBAR_GROUPNAME_CLASS);
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
      this.addItem('LayersGroup', new GroupName({ name: 'Layers' }));

      this.addItem(
        'openLayerBrowser',
        new CommandToolbarButton({
          id: CommandIDs.openLayerBrowser,
          label: '',
          commands: options.commands
        })
      );

      this.addItem(
        'newVectorLayer',
        new CommandToolbarButton({
          id: CommandIDs.newVectorLayer,
          label: '',
          commands: options.commands
        })
      );

      this.addItem('separator2', new Separator());
      this.addItem('SourcesGroup', new GroupName({ name: 'Sources' }));

      this.addItem(
        'newGeoJSONData',
        new CommandToolbarButton({
          id: CommandIDs.newGeoJSONData,
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
