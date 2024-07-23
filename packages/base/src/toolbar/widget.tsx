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
import { CommandIDs } from '../constants';
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
        'newVectorTileLayer',
        new CommandToolbarButton({
          id: CommandIDs.newVectorTileLayer,
          label: '',
          commands: options.commands
        })
      );

      this.addItem(
        'openLayerBrowser',
        new CommandToolbarButton({
          id: CommandIDs.openLayerBrowser,
          label: '',
          commands: options.commands
        })
      );

      this.addItem(
        'newGeoJSONLayer',
        new CommandToolbarButton({
          id: CommandIDs.newGeoJSONLayer,
          label: '',
          commands: options.commands
        })
      );

      this.addItem(
        'New Raster DEM Source',
        new CommandToolbarButton({
          id: CommandIDs.newRasterDemSource,
          label: '',
          commands: options.commands
        })
      );

      this.addItem(
        'newTerrain',
        new CommandToolbarButton({
          id: CommandIDs.newTerrain,
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
