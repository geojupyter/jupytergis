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
  undoIcon
} from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { Menu, Widget } from '@lumino/widgets';

import * as React from 'react';
import { CommandIDs } from '../constants';
import { rasterIcon, terminalToolbarIcon } from '../icons';
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
      const undoButton = new CommandToolbarButton({
        id: CommandIDs.undo,
        label: '',
        icon: undoIcon,
        commands: options.commands
      });

      this.addItem('undo', undoButton);
      undoButton.node.dataset.testid = 'undo-button';

      const redoButton = new CommandToolbarButton({
        id: CommandIDs.redo,
        label: '',
        icon: redoIcon,
        commands: options.commands
      });
      this.addItem('redo', redoButton);

      this.addItem('separator0', new Separator());

      const toggleConsoleButton = new CommandToolbarButton({
        id: CommandIDs.toggleConsole,
        commands: options.commands,
        label: '',
        icon: terminalToolbarIcon
      });
      this.addItem('Toggle console', toggleConsoleButton);
      toggleConsoleButton.node.dataset.testid = 'toggle-console-button';

      this.addItem('separator1', new Separator());

      const openLayersBrowserButton = new CommandToolbarButton({
        id: CommandIDs.openLayerBrowser,
        label: '',
        commands: options.commands
      });
      this.addItem('openLayerBrowser', openLayersBrowserButton);
      openLayersBrowserButton.node.dataset.testid = 'open-layers-browser';

      const geolocationButton = new CommandToolbarButton({
        id: CommandIDs.getGeolocation,
        commands: options.commands,
        label: ''
      });
      this.addItem('Geolocation', geolocationButton);

      geolocationButton.node.dataset.testid = 'geolocation-button';

      // vector sub menu
      const vectorSubMenu = new Menu({ commands: options.commands });

      vectorSubMenu.title.label = 'Add Vector Layer';
      vectorSubMenu.title.iconClass = 'fa fa-vector-square';
      vectorSubMenu.id = 'jp-gis-toolbar-vector-menu';

      vectorSubMenu.addItem({
        type: 'command',
        command: CommandIDs.newVectorTileEntry
      });

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
        command: CommandIDs.newRasterEntry
      });

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
      NewEntryButton.node.dataset.testid = 'new-entry-button';

      this.addItem('New', NewEntryButton);

      this.addItem('separator2', new Separator());

      const identifyButton = new CommandToolbarButton({
        id: CommandIDs.identify,
        label: '',
        commands: options.commands
      });

      this.addItem('identify', identifyButton);
      identifyButton.node.dataset.testid = 'identify-button';

      const temporalControllerButton = new CommandToolbarButton({
        id: CommandIDs.temporalController,
        label: '',
        commands: options.commands
      });
      this.addItem('temporalController', temporalControllerButton);
      temporalControllerButton.node.dataset.testid =
        'temporal-controller-button';

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
