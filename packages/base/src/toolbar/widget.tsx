import { UsersItem, DefaultIconRenderer } from '@jupyter/collaboration';
import {
  IUserData,
  IJGISExternalCommand,
  JupyterGISModel,
} from '@jupytergis/schema';
import { CommandToolbarButton } from '@jupyterlab/apputils';
import {
  MenuSvg,
  ReactWidget,
  ReactiveToolbar,
  Toolbar,
  ToolbarButton,
  addIcon,
} from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { Widget } from '@lumino/widgets';
import * as React from 'react';

import { CommandIDs } from '@/src/constants';
import { terminalToolbarIcon } from '@/src/icons';
import { rasterSubMenu, vectorSubMenu } from '@/src/menus';

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

function createUserIconRenderer(model: JupyterGISModel) {
  let selectedUserId: number | undefined;

  return (props: { user: IUserData }): JSX.Element => {
    const { user } = props;
    const isSelected = user.userId === selectedUserId;
    const className = isSelected ? 'selected' : '';

    const onClick = () => {
      if (user.userId === selectedUserId) {
        selectedUserId = undefined;
        model.setUserToFollow(undefined);
      } else {
        selectedUserId = user.userId;
        model.setUserToFollow(user.userId);
      }
    };

    return (
      <DefaultIconRenderer
        user={user}
        onClick={onClick}
        className={className}
      />
    );
  };
}

export class ToolbarWidget extends ReactiveToolbar {
  private _model: JupyterGISModel;
  private _newSubMenu: MenuSvg | null = null;

  constructor(options: ToolbarWidget.IOptions) {
    super();

    this._model = options.model;
    this.addClass('jGIS-toolbar-widget');

    if (options.commands) {
      const openLayersBrowserButton = new CommandToolbarButton({
        id: CommandIDs.openLayerBrowser,
        label: '',
        commands: options.commands,
      });

      this.addItem('openLayerBrowser', openLayersBrowserButton);
      openLayersBrowserButton.node.dataset.testid = 'open-layers-browser';

      const NewSubMenu = new MenuSvg({ commands: options.commands });
      NewSubMenu.title.label = 'Add Layer';
      this._newSubMenu = NewSubMenu;

      NewSubMenu.addItem({
        type: 'submenu',
        submenu: rasterSubMenu(options.commands),
      });
      NewSubMenu.addItem({
        type: 'submenu',
        submenu: vectorSubMenu(options.commands),
      });

      this._updateStorySegmentMenuItem();

      // Listen for settings changes
      this._model.settingsChanged.connect(this._onSettingsChanged, this);

      const NewEntryButton = new ToolbarButton({
        icon: addIcon,
        noFocusOnClick: false,
        onClick: () => {
          if (!options.commands) {
            return;
          }

          const bbox = NewEntryButton.node.getBoundingClientRect();

          NewSubMenu.open(bbox.x, bbox.bottom);
        },
      });

      this.addItem('New', NewEntryButton);
      NewEntryButton.node.dataset.testid = 'new-entry-button';

      this.addItem('separator1', new Separator());

      const geolocationButton = new CommandToolbarButton({
        id: CommandIDs.getGeolocation,
        commands: options.commands,
        label: '',
      });

      this.addItem('Geolocation', geolocationButton);
      geolocationButton.node.dataset.testid = 'geolocation-button';

      const identifyButton = new CommandToolbarButton({
        id: CommandIDs.identify,
        label: '',
        commands: options.commands,
      });

      this.addItem('identify', identifyButton);
      identifyButton.node.dataset.testid = 'identify-button';

      const temporalControllerButton = new CommandToolbarButton({
        id: CommandIDs.temporalController,
        label: '',
        commands: options.commands,
      });

      this.addItem('temporalController', temporalControllerButton);
      temporalControllerButton.node.dataset.testid =
        'temporal-controller-button';

      const addMarkerButton = new CommandToolbarButton({
        id: CommandIDs.addMarker,
        label: '',
        commands: options.commands,
      });

      this.addItem('addMarker', addMarkerButton);
      addMarkerButton.node.dataset.testid = 'add-marker-controller-button';

      const storyModePresentationToggleButton = new CommandToolbarButton({
        id: CommandIDs.toggleStoryPresentationMode,
        label: '',
        commands: options.commands,
      });

      this.addItem('toggleStoryPresentationMode', storyModePresentationToggleButton);
      identifyButton.node.dataset.testid = 'toggleStoryPresentationMode-button';

      this.addItem('separator2', new Separator());

      const toggleConsoleButton = new CommandToolbarButton({
        id: CommandIDs.toggleConsole,
        commands: options.commands,
        label: '',
        icon: terminalToolbarIcon,
      });
      this.addItem('Toggle console', toggleConsoleButton);
      toggleConsoleButton.node.dataset.testid = 'toggle-console-button';

      this.addItem('spacer', ReactiveToolbar.createSpacerItem());

      // Users
      const iconRenderer = createUserIconRenderer(this._model);
      this.addItem(
        'users',
        ReactWidget.create(
          <UsersItem model={this._model} iconRenderer={iconRenderer} />,
        ),
      );
    }
  }

  /**
   * Updates the story segment menu item based on settings
   */
  private _updateStorySegmentMenuItem(): void {
    if (!this._newSubMenu) {
      return;
    }

    const shouldShow = !this._model.jgisSettings.storyMapsDisabled;

    // Find if the item already exists by checking menu items
    let itemIndex: number | null = null;
    for (let i = 0; i < this._newSubMenu.items.length; i++) {
      const item = this._newSubMenu.items[i];
      if (
        item.type === 'command' &&
        item.command === CommandIDs.addStorySegment
      ) {
        itemIndex = i;
        break;
      }
    }

    const isCurrentlyAdded = itemIndex !== null;

    if (shouldShow && !isCurrentlyAdded) {
      this._newSubMenu.addItem({
        command: CommandIDs.addStorySegment,
      });
    } else if (!shouldShow && isCurrentlyAdded) {
      if (itemIndex !== null) {
        this._newSubMenu.removeItemAt(itemIndex);
      }
    }
  }

  /**
   * Handles settings changes
   */
  private _onSettingsChanged = (sender: JupyterGISModel, key: string): void => {
    if (key === 'storyMapsDisabled') {
      this._updateStorySegmentMenuItem();
    }
  };

  dispose(): void {
    if (this._model) {
      this._model.settingsChanged.disconnect(this._onSettingsChanged, this);
    }
    super.dispose();
  }
}

export namespace ToolbarWidget {
  export interface IOptions extends Toolbar.IOptions {
    commands?: CommandRegistry;
    model: JupyterGISModel;
    externalCommands: IJGISExternalCommand[];
  }
}
