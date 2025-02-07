import {
  IJupyterGISTracker,
  ISelection,
  JupyterGISDoc,
  SelectionType
} from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import { SidePanel } from '@jupyterlab/ui-components';
import { Message } from '@lumino/messaging';
import { MouseEvent as ReactMouseEvent } from 'react';
import { IControlPanelModel } from '../types';
import { LayersPanel } from './components/layers';
import { SourcesPanel } from './components/sources';
import { ControlPanelHeader } from './header';
import { FilterPanel } from './components/filter-panel/Filter';
import { CommandRegistry } from '@lumino/commands';
import { CommandIDs } from '../constants';

/**
 * Options of the left panel widget.
 */
export interface ILeftPanelOptions {
  model: IControlPanelModel;
  onSelect: ({ type, item, nodeId }: ILeftPanelClickHandlerParams) => void;
}

export interface ILayerPanelOptions extends ILeftPanelOptions {
  state: IStateDB;
}

export interface ILeftPanelClickHandlerParams {
  type: SelectionType;
  item: string;
  nodeId?: string;
  event: ReactMouseEvent;
}

export class LeftPanelWidget extends SidePanel {
  constructor(options: LeftPanelWidget.IOptions) {
    super();
    this.addClass('jGIS-sidepanel-widget');

    this._model = options.model;
    this._state = options.state;
    this._commands = options.commands;

    const header = new ControlPanelHeader();
    this.header.addWidget(header);

    const sourcesPanel = new SourcesPanel({
      model: this._model,
      onSelect: this._onSelect
    });
    sourcesPanel.title.caption = 'Sources';
    sourcesPanel.title.label = 'Sources';
    this.addWidget(sourcesPanel);

    const layerTree = new LayersPanel({
      model: this._model,
      state: this._state,
      onSelect: this._onSelect
    });
    layerTree.title.caption = 'Layer tree';
    layerTree.title.label = 'Layers';
    this.addWidget(layerTree);

    const filterPanel = new FilterPanel({
      model: this._model,
      tracker: options.tracker
    });

    filterPanel.title.caption = 'Filters';
    filterPanel.title.label = 'Filters';
    this.addWidget(filterPanel);

    options.tracker.currentChanged.connect((_, changed) => {
      if (changed) {
        header.title.label = changed.model.filePath;
      } else {
        header.title.label = '-';
      }
    });
  }

  dispose(): void {
    super.dispose();
  }

  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    const node = this.node;
    node.addEventListener('mouseup', this);
  }

  protected onBeforeDetach(msg: Message): void {
    super.onBeforeDetach(msg);
    const node = this.node;
    node.removeEventListener('mouseup', this);
  }

  handleEvent(event: Event): void {
    switch (event.type) {
      case 'mouseup':
        this._mouseUpEvent(event as MouseEvent);
        break;
      default:
        break;
    }
  }

  private _mouseUpEvent(event: MouseEvent): void {
    // If we click on empty space in the layer panel, keep the focus on the last selected element
    const node = document.getElementById(this._lastSelectedNodeId);
    if (!node) {
      return;
    }

    node.focus();
  }

  /**
   * Function to call when a layer is selected from a component of the panel.
   *
   * @param item - the selected layer or group.
   */
  private _onSelect = ({
    type,
    item,
    nodeId,
    event
  }: ILeftPanelClickHandlerParams) => {
    if (!this._model || !nodeId) {
      return;
    }

    const { jGISModel } = this._model;
    const selectedValue = jGISModel?.localState?.selected?.value;
    const node = document.getElementById(nodeId);

    if (!node) {
      return;
    }

    node.tabIndex = 0;
    node.focus();

    // Early return if no selection exists
    if (!selectedValue) {
      this.resetSelected(type, nodeId, item);
      return;
    }

    // Don't want to reset selected if right clicking a selected item
    if (!event.ctrlKey && event.button === 2 && item in selectedValue) {
      return;
    }

    // Reset selection for normal left click
    if (!event.ctrlKey) {
      this.resetSelected(type, nodeId, item);
      return;
    }

    if (nodeId) {
      // Check if new selection is the same type as previous selections
      const isSelectedSameType = Object.values(selectedValue).some(
        selection => selection.type === type
      );

      if (!isSelectedSameType) {
        // Selecting a new type, so reset selected
        this.resetSelected(type, nodeId, item);
        return;
      }

      // If types are the same add the selection
      const updatedSelectedValue = {
        ...selectedValue,
        [item]: { type, selectedNodeId: nodeId }
      };
      this._lastSelectedNodeId = nodeId;

      jGISModel.syncSelected(updatedSelectedValue, this.id);
      this._commands.notifyCommandChanged(CommandIDs.temporalController);
    }
  };

  resetSelected(type: SelectionType, nodeId?: string, item?: string) {
    const selection: { [key: string]: ISelection } = {};
    if (item && nodeId) {
      selection[item] = {
        type,
        selectedNodeId: nodeId
      };
      this._lastSelectedNodeId = nodeId;
    }
    this._model?.jGISModel?.syncSelected(selection, this.id);
    this._commands.notifyCommandChanged(CommandIDs.temporalController);
  }

  private _lastSelectedNodeId: string;
  private _model: IControlPanelModel;
  private _state: IStateDB;
  private _commands: CommandRegistry;
}

export namespace LeftPanelWidget {
  export interface IOptions {
    model: IControlPanelModel;
    tracker: IJupyterGISTracker;
    state: IStateDB;
    commands: CommandRegistry;
  }

  export interface IProps {
    filePath?: string;
    sharedModel?: JupyterGISDoc;
  }
}
