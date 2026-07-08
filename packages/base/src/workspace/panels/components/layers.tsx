import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  IJGISLayerGroup,
  IJGISLayerItem,
  IJGISLayerTree,
  IJupyterGISModel,
  ISelection,
  ProcessingMerge,
  SelectionType,
} from '@jupytergis/schema';
import { DOMUtils } from '@jupyterlab/apputils';
import { IStateDB } from '@jupyterlab/statedb';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import {
  Button,
  ContextMenuSvg,
  LabIcon,
  caretDownIcon,
  caretRightIcon,
} from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { ContextMenu, Menu } from '@lumino/widgets';
import React, {
  MouseEvent as ReactMouseEvent,
  useEffect,
  useState,
} from 'react';

import { CommandIDs, icons } from '@/src/constants';
import { useGetSymbology } from '@/src/features/layers/symbology/hooks/useGetSymbology';
import {
  nonVisibilityIcon,
  targetWithCenterIcon,
  visibilityIcon,
} from '@/src/shared/icons';
import { ILeftPanelClickHandlerParams } from '@/src/workspace/panels/leftpanel';
import { LegendItem } from './legendItem';
import { rasterSubMenu, vectorSubMenu } from '../../menus';

const LAYER_GROUP_CLASS = 'jp-gis-layerGroup';
const LAYER_GROUP_HEADER_CLASS = 'jp-gis-layerGroupHeader';
const LAYER_GROUP_COLLAPSER_CLASS = 'jp-gis-layerGroupCollapser';
const LAYER_ITEM_CLASS = 'jp-gis-layerItem';
const LAYER_CLASS = 'jp-gis-layer';
const LAYER_TITLE_CLASS = 'jp-gis-layerTitle';
const LAYER_ICON_CLASS = 'jp-gis-layerIcon';
const LAYER_TEXT_CLASS = 'jp-gis-layerText data-jgis-keybinding';
const LAYER_SLIDE_NUMBER_CLASS = 'jp-gis-layerSlideNumber';

interface IBodyProps {
  model: IJupyterGISModel;
  commands: CommandRegistry;
  state: IStateDB;
  layerTree: IJGISLayerTree;
}

function createContextMenu(
  commands: CommandRegistry,
  model: IJupyterGISModel,
  translator?: ITranslator,
) {
  translator = translator ?? nullTranslator;

  const GIS_LAYER_ITEM = '.jp-gis-layerItem:not(.jp-gis-layerGroup)';

  const gisContextMenu = new ContextMenuSvg({ commands });

  // LAYERS and LAYER GROUPS context menu
  gisContextMenu.addItem({
    command: CommandIDs.symbology,
    selector: GIS_LAYER_ITEM,
    rank: 1,
  });

  // Separator
  gisContextMenu.addItem({
    type: 'separator',
    selector: GIS_LAYER_ITEM,
    rank: 1.5,
  });

  gisContextMenu.addItem({
    command: CommandIDs.removeSelected,
    selector: GIS_LAYER_ITEM,
    rank: 3,
  });
  gisContextMenu.addItem({
    command: CommandIDs.removeSelected,
    selector: '.jp-gis-layerGroupHeader',
    rank: 3,
  });

  gisContextMenu.addItem({
    command: CommandIDs.renameSelected,
    selector: GIS_LAYER_ITEM,
    rank: 4,
  });
  gisContextMenu.addItem({
    command: CommandIDs.renameSelected,
    selector: '.jp-gis-layerGroupHeader',
    rank: 4,
  });

  gisContextMenu.addItem({
    command: CommandIDs.duplicateSelected,
    selector: GIS_LAYER_ITEM,
    rank: 5,
  });

  gisContextMenu.addItem({
    command: CommandIDs.zoomToLayer,
    selector: GIS_LAYER_ITEM,
    rank: 6,
  });

  const moveSelectedSubmenu = new Menu({ commands });
  moveSelectedSubmenu.title.label = translator
    .load('jupyterlab')
    .__('Move Selection to Group');
  moveSelectedSubmenu.id = 'jp-gis-contextmenu-movelayer';

  gisContextMenu.addItem({
    type: 'submenu',
    selector: GIS_LAYER_ITEM,
    rank: 7,
    submenu: moveSelectedSubmenu,
  });

  gisContextMenu.opened.connect(() => buildGroupsMenu(gisContextMenu, model));

  gisContextMenu.addItem({
    command: CommandIDs.zoomToLayer,
    selector: GIS_LAYER_ITEM,
    rank: 7,
  });

  gisContextMenu.addItem({
    command: CommandIDs.toggleDrawFeatures,
    selector: GIS_LAYER_ITEM,
    rank: 8,
  });

  // Separator
  gisContextMenu.addItem({
    type: 'separator',
    selector: GIS_LAYER_ITEM,
    rank: 8.5,
  });

  // Create the Download submenu
  const downloadSubmenu = new Menu({ commands: commands });
  downloadSubmenu.title.label = translator.load('jupyterlab').__('Download');
  downloadSubmenu.id = 'jp-gis-contextmenu-download';

  downloadSubmenu.addItem({
    command: CommandIDs.downloadGeoJSON,
  });

  // Add the Download submenu to the context menu
  gisContextMenu.addItem({
    type: 'submenu',
    selector: GIS_LAYER_ITEM,
    rank: 9,
    submenu: downloadSubmenu,
  });

  // Create the Processing submenu
  const processingSubmenu = new Menu({ commands });
  processingSubmenu.title.label = translator
    .load('jupyterlab')
    .__('Processing');
  processingSubmenu.id = 'jp-gis-contextmenu-processing';

  // Clip sub-submenu — groups all clipping operations
  const clipSubmenu = new Menu({ commands });
  clipSubmenu.title.label = translator.load('jupyterlab').__('Clip By');
  clipSubmenu.id = 'jp-gis-contextmenu-clip';

  for (const processingElement of ProcessingMerge) {
    if (processingElement.type === 'clip') {
      clipSubmenu.addItem({
        command: `jupytergis:${processingElement.name}`,
      });
    } else {
      processingSubmenu.addItem({
        command: `jupytergis:${processingElement.name}`,
      });
    }
  }

  processingSubmenu.addItem({ type: 'separator' });
  processingSubmenu.addItem({ type: 'submenu', submenu: clipSubmenu });

  gisContextMenu.addItem({
    type: 'submenu',
    selector: GIS_LAYER_ITEM,
    rank: 10,
    submenu: processingSubmenu,
  });

  const newLayerSubMenu = new Menu({ commands });
  newLayerSubMenu.title.label = translator.load('jupyterlab').__('Add Layer');
  newLayerSubMenu.id = 'jp-gis-contextmenu-addLayer';

  newLayerSubMenu.addItem({
    type: 'submenu',
    submenu: rasterSubMenu(commands),
  });
  newLayerSubMenu.addItem({
    type: 'submenu',
    submenu: vectorSubMenu(commands),
  });

  // Separator
  gisContextMenu.addItem({
    type: 'separator',
    selector: GIS_LAYER_ITEM,
    rank: 10.5,
  });

  gisContextMenu.addItem({
    type: 'submenu',
    selector: GIS_LAYER_ITEM,
    rank: 11,
    submenu: newLayerSubMenu,
  });

  return gisContextMenu;
}

/**
 * Populate submenu with current group names
 */
function buildGroupsMenu(contextMenu: ContextMenu, model: IJupyterGISModel) {
  const submenu =
    contextMenu.menu.items.find(
      item =>
        item.type === 'submenu' &&
        item.submenu?.id === 'jp-gis-contextmenu-movelayer',
    )?.submenu ?? null;

  // Bail early if the submenu isn't found
  if (!submenu) {
    return;
  }

  submenu.clearItems();

  // need a list of group name
  const layerTree = model.getLayerTree();
  const groupNames = getLayerGroupNames(layerTree);

  function getLayerGroupNames(layerTree: IJGISLayerItem[]): string[] {
    const result: string[] = [];

    for (const item of layerTree) {
      // Skip if the item is a layer id
      if (typeof item === 'string') {
        continue;
      }

      // Process group items
      if (item.layers) {
        result.push(item.name);

        // Recursively process the layers of the current item
        const nestedResults = getLayerGroupNames(item.layers);
        // Append the results of the recursive call to the main result array
        result.push(...nestedResults);
      }
    }

    return result;
  }

  submenu.addItem({
    command: CommandIDs.moveSelectedToGroup,
    args: { label: '' },
  });

  groupNames.forEach(name => {
    submenu.addItem({
      command: CommandIDs.moveSelectedToGroup,
      args: { label: name },
    });
  });

  submenu.addItem({
    command: CommandIDs.moveSelectedToNewGroup,
  });
}

export const LayersBodyComponent: React.FC<IBodyProps> = props => {
  const model = props.model;
  const commands = props.commands;

  const layerContextMenu = createContextMenu(commands, model);

  const [layerTree, setLayerTree] = useState<IJGISLayerTree>(
    props.layerTree || [],
  );

  const notifyCommands = () => {
    // Notify commands that need updating
    commands.notifyCommandChanged(CommandIDs.identify);
    commands.notifyCommandChanged(CommandIDs.temporalController);
    commands.notifyCommandChanged(CommandIDs.toggleDrawFeatures);
  };

  const _onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    layerContextMenu.open(e.nativeEvent);
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
        // If types are the same modify the selection (either add or remove to multi-selection)
        if (item in selectedValue) {
          const { [item]: _, ...rest } = selectedValue;
          newSelection = rest;
        } else {
          newSelection = {
            ...selectedValue,
            [item]: { type },
          };
        }
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

  // Update layerTree when prop changes
  useEffect(() => {
    if (props.layerTree) {
      setLayerTree(props.layerTree);
    }
  }, [props.layerTree]);

  return (
    <div
      id="jp-gis-layer-tree"
      onDrop={_onDrop}
      onDragOver={_onDragOver}
      onContextMenu={_onContextMenu}
    >
      {layerTree.map(layer =>
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
    const handleSelectedChanged = () => {
      // TODO Support follow mode and remoteUser state
      setSelected(isSelected(group.name, gisModel));
    };
    gisModel?.selectedChanged.connect(handleSelectedChanged);
    handleSelectedChanged();

    return () => {
      gisModel?.selectedChanged.disconnect(handleSelectedChanged);
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

  const handleGroupMoreClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onClick({
      type: 'group',
      item: name,
      event: e as unknown as ReactMouseEvent<HTMLElement>,
    });
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left,
        clientY: rect.bottom,
      }),
    );
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
        <Button
          className="jp-gis-layer-more-btn"
          minimal
          onClick={handleGroupMoreClick}
          title="More options"
        >
          <FontAwesomeIcon icon={faEllipsisVertical} />
        </Button>
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
  // ! todo this should never be undefined, like it's not possible in the parent, it will never be undef here
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
  const [expanded, setExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const { symbology } = useGetSymbology({
    layerId,
    model: gisModel as IJupyterGISModel,
  });

  const hasSupportedSymbology = symbology?.symbologyState !== undefined;

  const isStorySegmentLayer = layer.type === 'StorySegmentLayer';

  const name = layer.name;

  useEffect(() => {
    setId(DOMUtils.createDomID());
  }, []);

  /**
   * Listen to the changes on the current layer.
   */
  useEffect(() => {
    const handleSelectedChanged = () => {
      // TODO Support follow mode and remoteUser state
      setSelected(isSelected(layerId, gisModel));
    };
    gisModel?.selectedChanged.connect(handleSelectedChanged);
    handleSelectedChanged();

    return () => {
      gisModel?.selectedChanged.disconnect(handleSelectedChanged);
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

  const setSelection = (event: ReactMouseEvent<HTMLElement>) => {
    onClick({
      type: 'layer',
      item: layerId,
      event,
    });
  };

  const handleLayerMoreClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onClick({
      type: 'layer',
      item: layerId,
      event: e as unknown as ReactMouseEvent<HTMLElement>,
    });
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left,
        clientY: rect.bottom,
      }),
    );
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

  /**
   * Set layer to current map view.
   */
  const moveToExtent = () => {
    gisModel?.centerOnPosition(layerId);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    moveToExtent();
  };

  const getSlideNumber = () => {
    if (!gisModel) {
      return;
    }

    const { story } = gisModel.getSelectedStory();

    if (!story?.storySegments) {
      return;
    }

    const slideNum = story.storySegments.indexOf(layerId) + 1;

    return slideNum;
  };

  return (
    <div
      className={`${LAYER_ITEM_CLASS} ${LAYER_CLASS}
                  ${selected ? ' jp-mod-selected' : ''}`}
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
        {/* Expand/collapse legend button — always rendered to preserve alignment */}
        <Button
          minimal
          onClick={
            hasSupportedSymbology
              ? e => {
                  e.stopPropagation();
                  setExpanded(v => !v);
                }
              : undefined
          }
          title={
            hasSupportedSymbology
              ? expanded
                ? 'Hide legend'
                : 'Show legend'
              : undefined
          }
          style={{ visibility: hasSupportedSymbology ? 'visible' : 'hidden' }}
        >
          <LabIcon.resolveReact
            icon={expanded ? caretDownIcon : caretRightIcon}
            tag="span"
          />
        </Button>

        {/* Visibility toggle for normal layers, Slide number for story segments */}
        {isStorySegmentLayer ? (
          <span className={LAYER_SLIDE_NUMBER_CLASS} title="Slide number">
            {getSlideNumber()}
          </span>
        ) : (
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
        )}

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
          <span
            id={id}
            className={LAYER_TEXT_CLASS}
            tabIndex={-2}
            onDoubleClick={handleDoubleClick}
            title="Double-click to zoom to layer"
          >
            {name}
          </span>
        )}

        <Button
          title={'Move map to the extent of the layer'}
          onClick={moveToExtent}
          minimal
        >
          <LabIcon.resolveReact
            icon={targetWithCenterIcon}
            className={LAYER_ICON_CLASS}
            tag="span"
          />
        </Button>
        <Button
          className="jp-gis-layer-more-btn"
          minimal
          onClick={handleLayerMoreClick}
          title="More options"
        >
          <FontAwesomeIcon icon={faEllipsisVertical} />
        </Button>
      </div>

      {/* Show legend only if supported symbology */}
      {expanded && gisModel && hasSupportedSymbology && (
        <div
          style={{ marginTop: 6, width: '100%' }}
          onClick={setSelection}
          onContextMenu={setSelection}
        >
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
