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
import {
  Button,
  LabIcon,
  caretDownIcon,
  caretRightIcon,
} from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import React, {
  MouseEvent as ReactMouseEvent,
  useEffect,
  useState,
} from 'react';

import { CommandIDs, icons } from '@/src/constants';
import { useGetSymbology } from '@/src/dialogs/symbology/hooks/useGetSymbology';
import {
  nonVisibilityIcon,
  targetWithCenterIcon,
  visibilityIcon,
} from '@/src/icons';
import { ILeftPanelClickHandlerParams } from '@/src/panelview/leftpanel';
import { LegendItem } from './legendItem';

const LAYER_GROUP_CLASS = 'jp-gis-layerGroup';
const LAYER_GROUP_HEADER_CLASS = 'jp-gis-layerGroupHeader';
const LAYER_GROUP_COLLAPSER_CLASS = 'jp-gis-layerGroupCollapser';
const LAYER_ITEM_CLASS = 'jp-gis-layerItem';
const LAYER_CLASS = 'jp-gis-layer';
const LAYER_TITLE_CLASS = 'jp-gis-layerTitle';
const LAYER_ICON_CLASS = 'jp-gis-layerIcon';
const LAYER_TEXT_CLASS = 'jp-gis-layerText data-jgis-keybinding';

interface IBodyProps {
  model: IJupyterGISModel;
  commands: CommandRegistry;
  state: IStateDB;
  layerTree?: IJGISLayerTree;
}

export const LayersBodyComponent: React.FC<IBodyProps> = props => {
  const model = props.model;

  const [layerTree, setLayerTree] = useState<IJGISLayerTree>(
    props.layerTree || model?.getLayerTree() || [],
  );

  const notifyCommands = () => {
    // Notify commands that need updating
    props.commands.notifyCommandChanged(CommandIDs.identify);
    props.commands.notifyCommandChanged(CommandIDs.temporalController);
  };

  const _onDragOver = (e: React.DragEvent) => {
    e.stopPropagation();
    e.preventDefault();
    Private.dragInfo.dragOverElement = null;
    Private.dragInfo.dragOverPosition = null;
  };

  const _onDrop = (e: React.DragEvent) => {
    Private.dragIndicator.style.display = 'none';

    if (model === undefined) {
      return;
    }

    const { draggedElement, dragOverElement, dragOverPosition } =
      Private.dragInfo;

    if (dragOverElement === 'error') {
      return;
    }

    if (!draggedElement) {
      return;
    }
    const draggedId = draggedElement.dataset.id;
    if (!draggedId) {
      return;
    }

    // Element has been dropped in the empty zone below the tree.
    if (dragOverElement === null) {
      model?.moveItemsToGroup([draggedId], '', 0);
      return;
    }

    const dragOverId = dragOverElement.dataset.id;
    if (!dragOverId) {
      return;
    }

    // Handle the special case where we want to drop the element on top of the first
    // element of a group.
    if (
      dragOverElement.classList.contains(LAYER_GROUP_HEADER_CLASS) &&
      dragOverPosition === 'below'
    ) {
      model?.moveItemsToGroup([draggedId], dragOverId);
      return;
    }

    model?.moveItemRelatedTo(
      draggedId,
      dragOverId,
      dragOverPosition === 'above',
    );
  };

  const onSelect = ({ type, item, event }: ILeftPanelClickHandlerParams) => {
    if (!props.model) {
      return;
    }

    const selectedValue = props.model.selected;

    // Don't want to reset selected if right clicking a selected item
    if (
      selectedValue &&
      !event.ctrlKey &&
      event.button === 2 &&
      item in selectedValue
    ) {
      return;
    }

    // Calculate the new selection value
    let newSelection: { [key: string]: ISelection };

    // Early return if no selection exists - single selection
    if (!selectedValue) {
      newSelection = {
        [item]: {
          type,
        },
      };
    } else if (!event.ctrlKey) {
      // Reset selection for normal left click - single selection
      newSelection = {
        [item]: {
          type,
        },
      };
    } else {
      // Check if new selection is the same type as previous selections
      const isSelectedSameType = Object.values(selectedValue).some(
        selection => selection.type === type,
      );

      if (!isSelectedSameType) {
        // Selecting a new type, so reset selected - single selection
        newSelection = {
          [item]: {
            type,
          },
        };
      } else {
        // If types are the same add the selection - multi-selection
        newSelection = {
          ...selectedValue,
          [item]: { type },
        };
      }
    }

    // Set the selection
    props.model.selected = newSelection;
    notifyCommands();
  };

  /**
   * Propagate the layer selection.
   */
  const onItemClick = ({ type, item, event }: ILeftPanelClickHandlerParams) => {
    onSelect({ type, item, event });
  };

  /**
   * Listen to the layers and layer tree changes.
   */
  useEffect(() => {
    const updateLayers = () => {
      setLayerTree(props.layerTree || model?.getLayerTree() || []);
    };

    // Only listen to changes if layerTree is not provided as prop
    if (!props.layerTree) {
      model?.sharedModel.layersChanged.connect(updateLayers);
      model?.sharedModel.layerTreeChanged.connect(updateLayers);
    }

    updateLayers();
    return () => {
      if (!props.layerTree) {
        model?.sharedModel.layersChanged.disconnect(updateLayers);
        model?.sharedModel.layerTreeChanged.disconnect(updateLayers);
      }
    };
  }, [model, props.layerTree]);

  // Update layerTree when prop changes
  useEffect(() => {
    if (props.layerTree) {
      setLayerTree(props.layerTree);
    }
  }, [props.layerTree]);

  return (
    <div id="jp-gis-layer-tree" onDrop={_onDrop} onDragOver={_onDragOver}>
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
};

/**
 * Properties of the layer group component.
 */
interface ILayerGroupProps {
  gisModel: IJupyterGISModel | undefined;
  group: IJGISLayerGroup | undefined;
  state: IStateDB;
  onClick: ({ type, item }: ILeftPanelClickHandlerParams) => void;
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
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

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
  }, [gisModel, group.name]);

  /**
   * Listen to editing state changes.
   */
  useEffect(() => {
    const onEditingChanged = (
      sender: IJupyterGISModel,
      editing: { type: SelectionType; itemId: string } | null,
    ) => {
      if (editing?.type === 'group' && editing.itemId === name) {
        setIsEditing(true);
        setEditValue(name);
      } else {
        setIsEditing(false);
      }
    };

    // Check initial editing state
    const editing = gisModel?.editing;
    if (editing?.type === 'group' && editing.itemId === name) {
      setIsEditing(true);
      setEditValue(name);
    }

    gisModel?.editingChanged.connect(onEditingChanged);

    return () => {
      gisModel?.editingChanged.disconnect(onEditingChanged);
    };
  }, [gisModel, name]);

  const handleRightClick = (event: ReactMouseEvent<HTMLElement>) => {
    onClick({ type: 'group', item: name, event });
  };

  const handleExpand = async () => {
    state.save(`jupytergis:${group.name}`, { expanded: !open });
    setOpen(!open);
  };

  const handleRenameSave = () => {
    const newName = editValue.trim();
    if (newName && newName !== name && gisModel) {
      gisModel.renameLayerGroup(name, newName);
    }
    gisModel?.clearEditingItem();
  };

  const handleRenameCancel = () => {
    setEditValue(name);
    gisModel?.clearEditingItem();
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleRenameCancel();
    }
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
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameSave}
            className={LAYER_TEXT_CLASS}
            style={{
              flex: 1,
              border: '1px solid var(--jp-border-color1)',
              borderRadius: '2px',
              padding: '2px 4px',
              fontSize: 'inherit',
              fontFamily: 'inherit',
            }}
            autoFocus
          />
        ) : (
          <span id={id} className={LAYER_TEXT_CLASS} tabIndex={-2}>
            {name}
          </span>
        )}
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
  onClick: ({ type, item }: ILeftPanelClickHandlerParams) => void;
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
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const { symbology } = useGetSymbology({
    layerId,
    model: gisModel as IJupyterGISModel,
  });

  const hasSupportedSymbology = symbology?.symbologyState !== undefined;

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
  }, [gisModel, layerId]);

  /**
   * Listen to editing state changes.
   */
  useEffect(() => {
    const onEditingChanged = (
      sender: IJupyterGISModel,
      editing: { type: SelectionType; itemId: string } | null,
    ) => {
      if (editing?.type === 'layer' && editing.itemId === layerId) {
        setIsEditing(true);
        setEditValue(name);
      } else {
        setIsEditing(false);
      }
    };

    // Check initial editing state
    const editing = gisModel?.editing;
    if (editing?.type === 'layer' && editing.itemId === layerId) {
      setIsEditing(true);
      setEditValue(name);
    }

    gisModel?.editingChanged.connect(onEditingChanged);

    return () => {
      gisModel?.editingChanged.disconnect(onEditingChanged);
    };
  }, [gisModel, layerId, name]);

  /**
   * Toggle layer visibility.
   */
  const toggleVisibility = () => {
    layer.visible = !layer.visible;
    gisModel?.sharedModel?.updateLayer(layerId, layer);
  };

  const zoomToLayer = () => {
    gisModel?.centerOnPosition(layerId);
  };

  const setSelection = (event: ReactMouseEvent<HTMLElement>) => {
    onClick({
      type: 'layer',
      item: layerId,
      event,
    });
  };

  const handleRenameSave = () => {
    const newName = editValue.trim();
    if (newName && newName !== name && gisModel) {
      const updatedLayer = { ...layer, name: newName };
      gisModel.sharedModel.updateLayer(layerId, updatedLayer);
    }
    gisModel?.clearEditingItem();
  };

  const handleRenameCancel = () => {
    setEditValue(name);
    gisModel?.clearEditingItem();
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleRenameCancel();
    }
  };

  return (
    <div
      className={`${LAYER_ITEM_CLASS} ${LAYER_CLASS}${selected ? ' jp-mod-selected' : ''}`}
      draggable={true}
      onDragStart={Private.onDragStart}
      onDragOver={Private.onDragOver}
      onDragEnd={Private.onDragEnd}
      data-id={layerId}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <div
        className={LAYER_TITLE_CLASS}
        onClick={setSelection}
        onContextMenu={setSelection}
        style={{ display: 'flex' }}
      >
        {/* Expand/collapse legend button (only if symbology is supported) */}
        {hasSupportedSymbology && (
          <Button
            minimal
            onClick={e => {
              e.stopPropagation();
              setExpanded(v => !v);
            }}
            title={expanded ? 'Hide legend' : 'Show legend'}
          >
            <LabIcon.resolveReact
              icon={expanded ? caretDownIcon : caretRightIcon}
              tag="span"
            />
          </Button>
        )}

        {/* Visibility toggle */}
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

        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameSave}
            className={LAYER_TEXT_CLASS}
            style={{
              flex: 1,
              border: '1px solid var(--jp-border-color1)',
              borderRadius: '2px',
              padding: '2px 4px',
              fontSize: 'inherit',
              fontFamily: 'inherit',
            }}
            autoFocus
          />
        ) : (
          <span id={id} className={LAYER_TEXT_CLASS} tabIndex={-2}>
            {name}
          </span>
        )}
      </div>

      {/* Show legend only if supported symbology */}
      {expanded && gisModel && hasSupportedSymbology && (
        <div style={{ marginTop: 6, width: '100%' }}>
          <LegendItem layerId={layerId} model={gisModel} />
        </div>
      )}
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
