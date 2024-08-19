import {
  IJGISLayerGroup,
  IJGISLayerTree,
  IJupyterGISClientState,
  IJupyterGISModel
} from '@jupytergis/schema';
import { DOMUtils } from '@jupyterlab/apputils';
import {
  Button,
  LabIcon,
  ReactWidget,
  caretDownIcon
} from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import React, {
  MouseEvent as ReactMouseEvent,
  useEffect,
  useState
} from 'react';
import { icons } from '../../constants';
import { nonVisibilityIcon, visibilityIcon } from '../../icons';
import { IControlPanelModel } from '../../types';
import { ILeftPanelClickHandlerParams, ILeftPanelOptions } from '../leftpanel';

const LAYERS_PANEL_CLASS = 'jp-gis-layerPanel';
const LAYER_GROUP_CLASS = 'jp-gis-layerGroup';
const LAYER_GROUP_HEADER_CLASS = 'jp-gis-layerGroupHeader';
const LAYER_GROUP_COLLAPSER_CLASS = 'jp-gis-layerGroupCollapser';
const LAYER_ITEM_CLASS = 'jp-gis-layerItem';
const LAYER_CLASS = 'jp-gis-layer';
const LAYER_TITLE_CLASS = 'jp-gis-layerTitle';
const LAYER_ICON_CLASS = 'jp-gis-layerIcon';
const LAYER_TEXT_CLASS = 'jp-gis-layerText';

/**
 * The layers panel widget.
 */
export class LayersPanel extends Panel {
  constructor(options: ILeftPanelOptions) {
    super();
    this._model = options.model;
    this._onSelect = options.onSelect;

    this.id = 'jupytergis::layerTree';
    this.addClass(LAYERS_PANEL_CLASS);

    this.addWidget(
      ReactWidget.create(
        <LayersBodyComponent
          model={this._model}
          onSelect={this._onSelect}
        ></LayersBodyComponent>
      )
    );
    this.node.ondragover = this._onDragOver;
    this.node.ondrop = this._onDrop;
  }

  // This happens when dragging over empty space below the tree.
  private _onDragOver = (e: DragEvent) => {
    e.stopPropagation();
    e.preventDefault();
    this.node.appendChild(Private.dragIndicator);
    Private.dragInfo.dragOverElement = null;
    Private.dragInfo.dragOverPosition = null;
  };

  private _onDrop = (e: DragEvent) => {
    Private.dragIndicator.style.display = 'none';

    if (this._model === undefined) {
      return;
    }
    const { jGISModel: model } = this._model;

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
      dragOverPosition === 'above'
    );
  };

  private _model: IControlPanelModel | undefined;
  private _onSelect: ({
    type,
    item,
    nodeId
  }: ILeftPanelClickHandlerParams) => void;
}

/**
 * Properties of the layers body component.
 */
interface IBodyProps {
  model: IControlPanelModel;
  onSelect: ({ type, item, nodeId }: ILeftPanelClickHandlerParams) => void;
}

/**
 * The body component of the panel.
 */
function LayersBodyComponent(props: IBodyProps): JSX.Element {
  const [model, setModel] = useState<IJupyterGISModel | undefined>(
    props.model?.jGISModel
  );
  const [layerTree, setLayerTree] = useState<IJGISLayerTree>(
    model?.getLayerTree() || []
  );

  /**
   * Propagate the layer selection.
   */
  const onItemClick = ({
    type,
    item,
    nodeId,
    event
  }: ILeftPanelClickHandlerParams) => {
    props.onSelect({ type, item, nodeId, event });
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

    return () => {
      model?.sharedModel.layersChanged.disconnect(updateLayers);
      model?.sharedModel.layerTreeChanged.disconnect(updateLayers);
    };
  }, [model]);

  /**
   * Update the model when it changes.
   */
  props.model?.documentChanged.connect((_, widget) => {
    setModel(widget?.context.model);
    setLayerTree(widget?.context.model?.getLayerTree() || []);
  });

  return (
    <div id="jp-gis-layer-tree">
      {layerTree
        .slice()
        .reverse()
        .map(layer =>
          typeof layer === 'string' ? (
            <LayerComponent
              gisModel={model}
              layerId={layer}
              onClick={onItemClick}
            />
          ) : (
            <LayerGroupComponent
              gisModel={model}
              group={layer}
              onClick={onItemClick}
            />
          )
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
  onClick: ({ type, item, nodeId }: ILeftPanelClickHandlerParams) => void;
}

/**
 * The component to handle group of layers.
 */
function LayerGroupComponent(props: ILayerGroupProps): JSX.Element {
  const { group, gisModel, onClick } = props;

  if (group === undefined) {
    return <></>;
  }

  const [id, setId] = useState('');
  const [open, setOpen] = useState<boolean>(false);
  const name = group?.name ?? 'Undefined group';
  const layers = group?.layers ?? [];
  const [selected, setSelected] = useState<boolean>(
    // TODO Support multi-selection as `model?.jGISModel?.localState?.selected.value` does
    isSelected(group.name, gisModel)
  );

  useEffect(() => {
    setId(DOMUtils.createDomID());
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

  return (
    <div
      className={`${LAYER_ITEM_CLASS} ${LAYER_GROUP_CLASS}`}
      draggable={true}
      onDragStart={Private.onDragStart}
      onDragEnd={Private.onDragEnd}
      data-id={name}
    >
      <div
        onClick={() => setOpen(!open)}
        onContextMenu={handleRightClick}
        className={`${LAYER_GROUP_HEADER_CLASS} ${selected ? ' jp-mod-selected' : ''}`}
        onDragOver={Private.onDragOver}
        data-id={name}
      >
        <LabIcon.resolveReact
          icon={caretDownIcon}
          className={
            LAYER_GROUP_COLLAPSER_CLASS + (open ? ' jp-mod-expanded' : '')
          }
          tag={'span'}
        />
        <span id={id} className={LAYER_TEXT_CLASS}>
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
                  gisModel={gisModel}
                  layerId={layer}
                  onClick={onClick}
                />
              ) : (
                <LayerGroupComponent
                  gisModel={gisModel}
                  group={layer}
                  onClick={onClick}
                />
              )
            )}
        </div>
      )}
    </div>
  );
}

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
function LayerComponent(props: ILayerProps): JSX.Element {
  const { layerId, gisModel, onClick } = props;
  const layer = gisModel?.getLayer(layerId);
  if (layer === undefined) {
    return <></>;
  }

  const [id, setId] = useState('');
  const [selected, setSelected] = useState<boolean>(
    // TODO Support multi-selection as `model?.jGISModel?.localState?.selected.value` does
    isSelected(layerId, gisModel)
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
      clients: Map<number, IJupyterGISClientState>
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
    onClick({ type: 'layer', item: layerId, nodeId: childId, event });
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
        {icons.has(layer.type) && (
          <LabIcon.resolveReact
            {...icons.get(layer.type)}
            className={LAYER_ICON_CLASS}
          />
        )}
        <span id={id} className={LAYER_TEXT_CLASS}>
          {name}
        </span>
      </div>
      <Button
        title={layer.visible ? 'Hide layer' : 'Show layer'}
        onClick={toggleVisibility}
        minimal
      >
        <LabIcon.resolveReact
          icon={layer.visible ? visibilityIcon : nonVisibilityIcon}
          className={LAYER_ICON_CLASS}
          tag="span"
        />
      </Button>
    </div>
  );
}

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
    dragOverPosition: null
  };

  export const onDragStart = (e: React.DragEvent) => {
    dragInfo.draggedElement = e.target as HTMLDivElement;
  };

  export const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { clientY } = e;

    let target = (e.target as HTMLElement).closest(
      `.${LAYER_GROUP_HEADER_CLASS}, .${LAYER_ITEM_CLASS}`
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
