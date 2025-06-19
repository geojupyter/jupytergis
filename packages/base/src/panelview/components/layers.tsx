import {
  IJGISLayerGroup,
  IJGISLayerTree,
  IJupyterGISClientState,
  IJupyterGISModel,
  ISelection,
  SelectionType,
} from '@jupytergis/schema';
import { DOMUtils } from '@jupyterlab/apputils';
import { IStateDB } from '@jupyterlab/statedb';
import { Button, LabIcon, caretDownIcon } from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { ReadonlyPartialJSONObject, UUID } from '@lumino/coreutils';
import React, {
  MouseEvent as ReactMouseEvent,
  useEffect,
  useState,
} from 'react';

import { CommandIDs, icons } from '@/src/constants';
import { nonVisibilityIcon, visibilityIcon } from '@/src/icons';
import { ILeftPanelClickHandlerParams } from '@/src/panelview/leftpanel';

// const LAYERS_PANEL_CLASS = 'jp-gis-layerPanel';
const LAYER_GROUP_CLASS = 'jp-gis-layerGroup';
const LAYER_GROUP_HEADER_CLASS = 'jp-gis-layerGroupHeader';
const LAYER_GROUP_COLLAPSER_CLASS = 'jp-gis-layerGroupCollapser';
const LAYER_ITEM_CLASS = 'jp-gis-layerItem';
const LAYER_CLASS = 'jp-gis-layer';
const LAYER_TITLE_CLASS = 'jp-gis-layerTitle';
const LAYER_ICON_CLASS = 'jp-gis-layerIcon';
const LAYER_TEXT_CLASS = 'jp-gis-layerText data-jgis-keybinding';

/**
 * Properties of the layers body component.
 */
interface IBodyProps {
  model: IJupyterGISModel;
  commands: CommandRegistry;
  state: IStateDB;
}

/**
 * The body component of the panel.
 */
export function LayersBodyComponent(props: IBodyProps): JSX.Element {
  const model = props.model;
  const id = UUID.uuid4();

  const [layerTree, setLayerTree] = useState<IJGISLayerTree>(
    model?.getLayerTree() || [],
  );

  const notifyCommands = () => {
    // Notify commands that need updating
    props.commands.notifyCommandChanged(CommandIDs.identify);
    props.commands.notifyCommandChanged(CommandIDs.temporalController);
  };

  const onSelect = ({
    type,
    item,
    nodeId,
    event,
  }: ILeftPanelClickHandlerParams) => {
    if (!props.model || !nodeId) {
      return;
    }

    const selectedValue = props.model.localState?.selected?.value;
    const node = document.getElementById(nodeId);

    if (!node) {
      return;
    }

    node.tabIndex = 0;
    node.focus();

    // Early return if no selection exists
    if (!selectedValue) {
      resetSelected(type, nodeId, item);
      return;
    }

    // Don't want to reset selected if right clicking a selected item
    if (!event.ctrlKey && event.button === 2 && item in selectedValue) {
      return;
    }

    // Reset selection for normal left click
    if (!event.ctrlKey) {
      resetSelected(type, nodeId, item);
      return;
    }

    if (nodeId) {
      // Check if new selection is the same type as previous selections
      const isSelectedSameType = Object.values(selectedValue).some(
        selection => selection.type === type,
      );

      if (!isSelectedSameType) {
        // Selecting a new type, so reset selected
        resetSelected(type, nodeId, item);
        return;
      }

      // If types are the same add the selection
      const updatedSelectedValue = {
        ...selectedValue,
        [item]: { type, selectedNodeId: nodeId },
      };

      props.model.syncSelected(updatedSelectedValue, id);

      notifyCommands();
    }
  };

  const resetSelected = (
    type: SelectionType,
    nodeId?: string,
    item?: string,
  ) => {
    const selection: { [key: string]: ISelection } = {};
    if (item && nodeId) {
      selection[item] = {
        type,
        selectedNodeId: nodeId,
      };
    }
    props.model.syncSelected(selection, id);

    notifyCommands();
  };

  /**
   * Propagate the layer selection.
   */
  const onItemClick = ({
    type,
    item,
    nodeId,
    event,
  }: ILeftPanelClickHandlerParams) => {
    onSelect({ type, item, nodeId, event });
  };

  /**
   * Listen to the layers and layer tree changes.
   */
  useEffect(() => {
    const updateLayers = () => {
      setLayerTree(model?.getLayerTree() || []);
    };
    model?.sharedModel.layersChanged.connect(updateLayers);
    model?.sharedModel.layerTreeChanged.connect(updateLayers);

    updateLayers();
    return () => {
      model?.sharedModel.layersChanged.disconnect(updateLayers);
      model?.sharedModel.layerTreeChanged.disconnect(updateLayers);
    };
  }, [model]);

  return (
    <div id="jp-gis-layer-tree">
      {layerTree
        .slice()
        .reverse()
        .map(layer =>
          typeof layer === 'string' ? (
            <LayerComponent
              key={layer}
              gisModel={model}
              layerId={layer}
              onClick={onItemClick}
            />
          ) : (
            <LayerGroupComponent
              key={layer.name}
              gisModel={model}
              group={layer}
              onClick={onItemClick}
              state={props.state}
            />
          ),
        )}
    </div>
  );
}

/**
 * Properties of the layer group component.
 */
interface ILayerGroupProps {
  gisModel: IJupyterGISModel | undefined;
  group: IJGISLayerGroup | undefined;
  state: IStateDB;
  onClick: ({ type, item, nodeId }: ILeftPanelClickHandlerParams) => void;
}

/**
 * The component to handle group of layers.
 */
const LayerGroupComponent: React.FC<ILayerGroupProps> = props => {
  const { group, gisModel, onClick, state } = props;

  if (group === undefined) {
    return <></>;
  }

  const [id, setId] = useState('');
  const [open, setOpen] = useState<boolean>(false);
  const name = group?.name ?? 'Undefined group';
  const layers = group?.layers ?? [];
  const [selected, setSelected] = useState<boolean>(
    // TODO Support multi-selection as `model?.jGISModel?.localState?.selected.value` does
    isSelected(group.name, gisModel),
  );

  useEffect(() => {
    setId(DOMUtils.createDomID());
    const getExpandedState = async () => {
      const groupState = await state.fetch(`jupytergis:${group.name}`);

      setOpen(
        ((groupState as ReadonlyPartialJSONObject)?.expanded as boolean) ??
          false,
      );
    };

    getExpandedState();
  }, []);

  /**
   * Listen to the changes on the current layer.
   */
  useEffect(() => {
    const onClientSharedStateChanged = () => {
      // TODO Support follow mode and remoteUser state
      setSelected(isSelected(group.name, gisModel));
    };
    gisModel?.clientStateChanged.connect(onClientSharedStateChanged);

    return () => {
      gisModel?.clientStateChanged.disconnect(onClientSharedStateChanged);
    };
  }, [gisModel]);

  const handleRightClick = (event: ReactMouseEvent<HTMLElement>) => {
    const childId = event.currentTarget.children.namedItem(id)?.id;
    onClick({ type: 'group', item: name, nodeId: childId, event });
  };

  const handleExpand = async () => {
    state.save(`jupytergis:${group.name}`, { expanded: !open });
    setOpen(!open);
  };

  return (
    <div
      className={`${LAYER_ITEM_CLASS} ${LAYER_GROUP_CLASS}`}
      draggable={true}
      onDragStart={Private.onDragStart}
      onDragEnd={Private.onDragEnd}
      data-id={name}
    >
      <div
        onClick={handleExpand}
        onContextMenu={handleRightClick}
        className={`${LAYER_GROUP_HEADER_CLASS}${selected ? ' jp-mod-selected' : ''}`}
        onDragOver={Private.onDragOver}
        data-id={name}
      >
        <LabIcon.resolveReact
          icon={caretDownIcon}
          className={`${LAYER_GROUP_COLLAPSER_CLASS}${open ? ' jp-mod-expanded' : ''}`}
          tag={'span'}
        />
        <span id={id} className={LAYER_TEXT_CLASS} tabIndex={-2}>
          {name}
        </span>
      </div>
      {open && (
        <div>
          {layers
            .slice()
            .reverse()
            .map(layer =>
              typeof layer === 'string' ? (
                <LayerComponent
                  key={layer}
                  gisModel={gisModel}
                  layerId={layer}
                  onClick={onClick}
                />
              ) : (
                <LayerGroupComponent
                  key={layer.name}
                  gisModel={gisModel}
                  group={layer}
                  onClick={onClick}
                  state={props.state}
                />
              ),
            )}
        </div>
      )}
    </div>
  );
};

/**
 * Properties of the layer component.
 */
interface ILayerProps {
  gisModel: IJupyterGISModel | undefined;
  layerId: string;
  onClick: ({ type, item, nodeId }: ILeftPanelClickHandlerParams) => void;
}

function isSelected(layerId: string, model: IJupyterGISModel | undefined) {
  return (
    (model?.localState?.selected?.value &&
      Object.keys(model?.localState?.selected?.value).includes(layerId)) ||
    false
  );
}

/**
 * The component to display a single layer.
 */
const LayerComponent: React.FC<ILayerProps> = props => {
  const { layerId, gisModel, onClick } = props;
  const layer = gisModel?.getLayer(layerId);
  if (layer === undefined) {
    return <></>;
  }

  const [id, setId] = useState('');
  const [selected, setSelected] = useState<boolean>(
    // TODO Support multi-selection as `model?.jGISModel?.localState?.selected.value` does
    isSelected(layerId, gisModel),
  );
  const name = layer.name;

  useEffect(() => {
    setId(DOMUtils.createDomID());
  }, []);

  /**
   * Listen to the changes on the current layer.
   */
  useEffect(() => {
    const onClientSharedStateChanged = (
      sender: IJupyterGISModel,
      clients: Map<number, IJupyterGISClientState>,
    ) => {
      // TODO Support follow mode and remoteUser state
      setSelected(isSelected(layerId, gisModel));
    };
    gisModel?.clientStateChanged.connect(onClientSharedStateChanged);

    return () => {
      gisModel?.clientStateChanged.disconnect(onClientSharedStateChanged);
    };
  }, [gisModel]);

  /**
   * Toggle layer visibility.
   */
  const toggleVisibility = () => {
    layer.visible = !layer.visible;
    gisModel?.sharedModel?.updateLayer(layerId, layer);
  };

  const setSelection = (event: ReactMouseEvent<HTMLElement>) => {
    const childId = event.currentTarget.children.namedItem(id)?.id;
    onClick({
      type: 'layer',
      item: layerId,
      nodeId: childId,
      event,
    });
  };

  return (
    <div
      className={`${LAYER_ITEM_CLASS} ${LAYER_CLASS}${selected ? ' jp-mod-selected' : ''}`}
      draggable={true}
      onDragStart={Private.onDragStart}
      onDragOver={Private.onDragOver}
      onDragEnd={Private.onDragEnd}
      data-id={layerId}
    >
      <div
        className={LAYER_TITLE_CLASS}
        onClick={setSelection}
        onContextMenu={setSelection}
      >
        <Button
          title={layer.visible ? 'Hide layer' : 'Show layer'}
          onClick={toggleVisibility}
          minimal
        >
          <LabIcon.resolveReact
            icon={layer.visible ? visibilityIcon : nonVisibilityIcon}
            className={`${LAYER_ICON_CLASS}${layer.visible ? '' : ' jp-gis-mod-hidden'}`}
            tag="span"
          />
        </Button>

        {icons.has(layer.type) && (
          <LabIcon.resolveReact
            {...icons.get(layer.type)}
            className={LAYER_ICON_CLASS}
          />
        )}

        <span id={id} className={LAYER_TEXT_CLASS} tabIndex={-2}>
          {name}
        </span>
      </div>
    </div>
  );
};

namespace Private {
  export const dragIndicator = document.createElement('div');
  dragIndicator.id = 'jp-drag-indicator';

  interface IDragInfo {
    draggedElement: HTMLDivElement | null;
    dragOverElement: HTMLDivElement | null | 'error';
    dragOverPosition: 'above' | 'below' | null;
  }

  export const dragInfo: IDragInfo = {
    draggedElement: null,
    dragOverElement: null,
    dragOverPosition: null,
  };

  export const onDragStart = (e: React.DragEvent) => {
    dragInfo.draggedElement = e.target as HTMLDivElement;
  };

  export const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { clientY } = e;

    let target = (e.target as HTMLElement).closest(
      `.${LAYER_GROUP_HEADER_CLASS}, .${LAYER_ITEM_CLASS}`,
    ) as HTMLDivElement;

    if (!target) {
      return;
    }

    // Do not allow move a group into itself.
    if (dragInfo.draggedElement?.contains(target)) {
      dragInfo.dragOverElement = 'error';
      return;
    }

    dragInfo.dragOverElement = target;
    const boundingBox = target.getBoundingClientRect();
    if (clientY - boundingBox.top < boundingBox.bottom - clientY) {
      dragInfo.dragOverPosition = 'above';
      if (target.classList.contains(LAYER_GROUP_HEADER_CLASS)) {
        target = target.parentNode as HTMLDivElement;
      }
      target.insertAdjacentElement('beforebegin', dragIndicator);
      dragIndicator.style.display = 'block';
    } else {
      dragInfo.dragOverPosition = 'below';
      target.insertAdjacentElement('afterend', dragIndicator);
      dragIndicator.style.display = 'block';
    }
  };

  export const onDragEnd = () => {
    dragIndicator.style.display = 'none';
    dragInfo.draggedElement = null;
    dragInfo.dragOverElement = null;
    dragInfo.dragOverPosition = null;
  };
}
