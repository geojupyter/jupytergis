import { IJGISExternalCommand, JupyterGISModel } from '@jupytergis/schema';
import { CommandToolbarButton } from '@jupyterlab/apputils';
import {
  MenuSvg,
  ReactWidget,
  ReactiveToolbar,
  Toolbar,
  ToolbarButton,
  addIcon,
  redoIcon,
  terminalIcon,
  undoIcon
} from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { Menu, Widget } from '@lumino/widgets';

import * as React from 'react';
import { CommandIDs } from '../constants';
import { rasterIcon } from '../icons';
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

export class ToolbarWidget extends ReactiveToolbar {
  constructor(options: ToolbarWidget.IOptions) {
    super();

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

      this.addItem('separator0', new Separator());

      this.addItem(
        'Toggle console',
        new CommandToolbarButton({
          id: CommandIDs.toggleConsole,
          commands: options.commands,
          label: '',
          icon: terminalIcon
        })
      );

      this.addItem('separator1', new Separator());

      this.addItem(
        'openLayerBrowser',
        new CommandToolbarButton({
          id: CommandIDs.openLayerBrowser,
          label: '',
          commands: options.commands
        })
      );

      this.addItem(
        'newRasterEntry',
        new CommandToolbarButton({
          id: CommandIDs.newRasterEntry,
          label: '',
          commands: options.commands
        })
      );

      this.addItem(
        'newVectorTileEntry',
        new CommandToolbarButton({
          id: CommandIDs.newVectorTileEntry,
          label: '',
          commands: options.commands
        })
      );

      // vector sub menu
      const vectorSubMenu = new Menu({ commands: options.commands });

      vectorSubMenu.title.label = 'Add Vector Layer';
      vectorSubMenu.title.iconClass = 'fa fa-vector-square';
      vectorSubMenu.id = 'jp-gis-toolbar-vector-menu';

      vectorSubMenu.addItem({
        type: 'command',
        command: CommandIDs.newGeoJSONEntry
      });

      vectorSubMenu.addItem({
        type: 'command',
        command: CommandIDs.newShapefileLayer
      });

      //raster submenu
      const rasterSubMenu = new Menu({ commands: options.commands });

      rasterSubMenu.title.label = 'Add Raster Layer';
      rasterSubMenu.title.icon = rasterIcon;
      rasterSubMenu.id = 'jp-gis-toolbar-raster-menu';

      rasterSubMenu.addItem({
        type: 'command',
        command: CommandIDs.newHillshadeEntry
      });

      rasterSubMenu.addItem({
        type: 'command',
        command: CommandIDs.newImageEntry
      });

      rasterSubMenu.addItem({
        type: 'command',
        command: CommandIDs.newGeoTiffEntry
      });

      const NewSubMenu = new MenuSvg({ commands: options.commands });
      NewSubMenu.title.label = 'Add Layer';

      NewSubMenu.addItem({ type: 'submenu', submenu: rasterSubMenu });
      NewSubMenu.addItem({ type: 'submenu', submenu: vectorSubMenu });

      const NewEntryButton = new ToolbarButton({
        icon: addIcon,
        noFocusOnClick: false,
        onClick: () => {
          if (!options.commands) {
            return;
          }

          const bbox = NewEntryButton.node.getBoundingClientRect();

          NewSubMenu.open(bbox.x, bbox.bottom);
        }
      });

      this.addItem('New', NewEntryButton);

      this.addItem('separator2', new Separator());

      this.addItem(
        'identify',
        new CommandToolbarButton({
          id: CommandIDs.identify,
          label: '',
          commands: options.commands
        })
      );

      this.addItem(
        'temporalController',
        new CommandToolbarButton({
          id: CommandIDs.temporalController,
          label: '',
          commands: options.commands
        })
      );

      this.addItem('spacer', ReactiveToolbar.createSpacerItem());

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
