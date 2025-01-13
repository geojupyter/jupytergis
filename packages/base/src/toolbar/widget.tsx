import { IJGISExternalCommand, JupyterGISModel } from '@jupytergis/schema';
import { CommandToolbarButton } from '@jupyterlab/apputils';
import {
  ReactWidget,
  Toolbar,
  ReactiveToolbar,
  ToolbarButton,
  addIcon,
  redoIcon,
  undoIcon,
  terminalIcon
} from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { Menu, Widget } from '@lumino/widgets';

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

      options.commands.addKeyBinding({
        command: CommandIDs.undo,
        keys: ['Accel Z'],
        selector: '#main'
      });

      this.addItem(
        'redo',
        new CommandToolbarButton({
          id: CommandIDs.redo,
          label: '',
          icon: redoIcon,
          commands: options.commands
        })
      );

      options.commands.addKeyBinding({
        command: CommandIDs.redo,
        keys: ['Accel Shift Z'],
        selector: '#main'
      });

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

      const NewButton = new ToolbarButton({
        icon: addIcon,
        noFocusOnClick: false,
        onClick: () => {
          if (!options.commands) {
            return;
          }

          const bbox = NewButton.node.getBoundingClientRect();
          const NewSubMenu = new Menu({ commands: options.commands });
          NewSubMenu.title.label = 'New Layer';

          NewSubMenu.addItem({
            type: 'command',
            command: CommandIDs.newHillshadeEntry
          });

          NewSubMenu.addItem({
            type: 'separator'
          });

          NewSubMenu.addItem({
            type: 'command',
            command: CommandIDs.newImageEntry
          });

          NewSubMenu.addItem({
            type: 'separator'
          });

          NewSubMenu.addItem({
            type: 'command',
            command: CommandIDs.newShapefileLayer
          });

          NewSubMenu.addItem({
            type: 'command',
            command: CommandIDs.newGeoTiffEntry
          });

          NewSubMenu.addItem({
            type: 'command',
            command: CommandIDs.newGeoJSONEntry
          });

          NewSubMenu.open(bbox.x, bbox.bottom);
        }
      });

      this.addItem('New', NewButton);

      this.addItem('separator2', new Separator());

      this.addItem(
        'identify',
        new CommandToolbarButton({
          id: CommandIDs.identify,
          label: '',
          commands: options.commands
        })
      );

      options.commands.addKeyBinding({
        command: CommandIDs.identify,
        keys: ['Escape'],
        selector: '#main'
      });

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
