import {
  IJGISLayerGroup,
  IJGISLayerItem,
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
import { nonVisibilityIcon, rasterIcon, visibilityIcon } from '../../icons';
import { IControlPanelModel } from '../../types';

const LAYERS_PANEL_CLASS = 'jp-gis-layerPanel';
const LAYER_GROUP_CLASS = 'jp-gis-layerGroup';
const LAYER_GROUP_HEADER_CLASS = 'jp-gis-layerGroupHeader';
const LAYER_GROUP_COLLAPSER_CLASS = 'jp-gis-layerGroupCollapser';
const LAYER_ITEM_CLASS = 'jp-gis-layerItem';
const LAYER_CLASS = 'jp-gis-layer';
const LAYER_TITLE_CLASS = 'jp-gis-layerTitle';
const LAYER_ICON_CLASS = 'jp-gis-layerIcon';

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
    item?: string;
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
    if (this._model) {
      if (!event.ctrlKey) {
        // No ctrl, then reset selected
        this.resetSelected(type, nodeId, item);
        return;
      } else {
        // If click is on different type, reset selected
        const c = this._model.jGISModel?.localState?.selected?.value;

        c &&
          Object.values(c).forEach((v, i, a) => {
            if (v.type !== type) {
              this.resetSelected(type, nodeId, item);
              return;
            }
          });
      }
      // so not ctrl is being held
      const select = this._model.jGISModel?.localState?.selected?.value;
      if (!select) {
        // selected is undefined, so this is the first selection
        this.resetSelected(type, nodeId, item);
      } else {
        // ok now we're adding other selections
        if (item && nodeId) {
          select[item] = {
            type,
            selectedNodeId: nodeId
          };
        }
        this._model?.jGISModel?.syncSelected(select, this.id);
        console.log('celectec', select);
      }
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

  layerTreeRecursion(
    items: IJGISLayerItem[],
    current: string[] = []
  ): string[] {
    for (const layer of items) {
      if (typeof layer === 'string') {
        current.push(layer);
      } else {
        current.push(...this.layerTreeRecursion(layer.layers));
      }
    }
    return current;
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
      console.log('updating layers');
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
    <div>
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
        <span id={id}>{name}</span>
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
  const v = model?.localState?.selected?.value;
  console.log(
    'model?.localState?.selected?.value',
    model?.localState?.selected?.value
  );

  v &&
    console.log(
      'Object.keys(model?.localState?.selected?.value).includes(layerId)',
      Object.keys(v).includes(layerId)
    );

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
        {layer.type === 'RasterLayer' && (
          <LabIcon.resolveReact
            icon={rasterIcon}
            className={LAYER_ICON_CLASS}
          />
        )}
        <span id={id}>{name}</span>
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
