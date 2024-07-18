import {
  IJGISLayerGroup,
  IJGISLayerTree,
  IJupyterGISClientState,
  IJupyterGISModel,
  ISelection,
  SelectionType
} from '@jupytergis/schema';
import { DOMUtils } from '@jupyterlab/apputils';
import {
  Button,
  LabIcon,
  ReactWidget,
  caretDownIcon
} from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import React, { MouseEvent, useEffect, useState } from 'react';
import { icons } from '../../constants';
import { nonVisibilityIcon, visibilityIcon } from '../../icons';
import { IControlPanelModel } from '../../types';

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
 * The namespace for the layers panel.
 */
export namespace LayersPanel {
  /**
   * Options of the layers panel widget.
   */
  export interface IOptions {
    model: IControlPanelModel;
  }

  export interface IClickHandlerParams {
    type: SelectionType;
    item: string;
    nodeId?: string;
    event: MouseEvent;
  }
}

/**
 * The layers panel widget.
 */
export class LayersPanel extends Panel {
  constructor(options: LayersPanel.IOptions) {
    super();
    this._model = options.model;
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
  }: LayersPanel.IClickHandlerParams) => {
    if (!this._model) {
      return;
    }

    const { jGISModel } = this._model;
    const selectedValue = jGISModel?.localState?.selected?.value;

    (event.target as HTMLElement).tabIndex = 0;
    (event.target as HTMLElement).focus();

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

      jGISModel.syncSelected(updatedSelectedValue, this.id);
    }
  };

  resetSelected(type: SelectionType, nodeId?: string, item?: string) {
    const selection: { [key: string]: ISelection } = {};
    if (item && nodeId) {
      selection[item] = {
        type,
        selectedNodeId: nodeId
      };
    }
    this._model?.jGISModel?.syncSelected(selection, this.id);
  }

  private _model: IControlPanelModel | undefined;
}

/**
 * Properties of the layers body component.
 */
interface IBodyProps {
  model: IControlPanelModel;
  onSelect: ({ type, item, nodeId }: LayersPanel.IClickHandlerParams) => void;
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
  }: LayersPanel.IClickHandlerParams) => {
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
    model?.clientStateChanged.connect(updateLayers);

    return () => {
      model?.sharedModel.layersChanged.disconnect(updateLayers);
      model?.sharedModel.layerTreeChanged.disconnect(updateLayers);
      model?.clientStateChanged.disconnect(updateLayers);
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
      {layerTree.map(layer =>
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
  onClick: ({ type, item, nodeId }: LayersPanel.IClickHandlerParams) => void;
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

  useEffect(() => {
    setId(DOMUtils.createDomID());
  }, []);

  const handleRightClick = (event: MouseEvent<HTMLElement>) => {
    const childId = event.currentTarget.children.namedItem(id)?.id;
    onClick({ type: 'group', item: name, nodeId: childId, event });
  };

  return (
    <div className={`${LAYER_ITEM_CLASS} ${LAYER_GROUP_CLASS}`}>
      <div
        onClick={() => setOpen(!open)}
        onContextMenu={handleRightClick}
        className={LAYER_GROUP_HEADER_CLASS}
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
          {layers.map(layer =>
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
  onClick: ({ type, item, nodeId }: LayersPanel.IClickHandlerParams) => void;
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

  const setSelection = (event: MouseEvent<HTMLElement>) => {
    const childId = event.currentTarget.children.namedItem(id)?.id;
    onClick({ type: 'layer', item: layerId, nodeId: childId, event });
  };

  return (
    <div
      className={`${LAYER_ITEM_CLASS} ${LAYER_CLASS}${selected ? ' jp-mod-selected' : ''}`}
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
