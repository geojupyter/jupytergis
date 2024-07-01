import {
  IJGISLayersGroup,
  IJGISLayersTree,
  IJupyterGISClientState,
  IJupyterGISModel,
  ISelection
} from '@jupytergis/schema';
import {
  Button,
  LabIcon,
  ReactWidget,
  caretDownIcon
} from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import React, { useEffect, useState } from 'react';
import { nonVisibilityIcon, rasterIcon, visibilityIcon } from '../../icons';
import { IControlPanelModel } from '../../types';

const LAYERS_PANEL_CLASS = 'jp-gis-layerPanel';
const LAYERS_GROUP_CLASS = 'jp-gis-layersGroup';
const LAYERS_GROUP_HEADER_CLASS = 'jp-gis-layersGroupHeader';
const LAYERS_GROUP_COLLAPSER_CLASS = 'jp-gis-layersGroupCollapser';
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
}

/**
 * The layers panel widget.
 */
export class LayersPanel extends Panel {
  constructor(options: LayersPanel.IOptions) {
    super();
    this._model = options.model;
    this.id = 'jupytergis::layersTree';
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
   * @param layer - the selected layer.
   */
  private _onSelect = (layer?: string) => {
    if (this._model) {
      const selection: { [key: string]: ISelection } = {};
      if (layer) {
        selection[layer] = {
          type: 'layer'
        };
      }
      this._model?.jGISModel?.syncSelected(selection, this.id);
    }
  };

  private _model: IControlPanelModel | undefined;
}

/**
 * Properties of the layers body component.
 */
interface IBodyProps {
  model: IControlPanelModel;
  onSelect: (layer?: string) => void;
}

/**
 * The body component of the panel.
 */
function LayersBodyComponent(props: IBodyProps): JSX.Element {
  const [model, setModel] = useState<IJupyterGISModel | undefined>(
    props.model?.jGISModel
  );
  const [layersTree, setLayersTree] = useState<IJGISLayersTree>(
    model?.getLayersTree() || []
  );

  console.log('first render of the tree', model?.getLayersTree());

  /**
   * Propagate the layer selection.
   */
  const onItemClick = (item?: string) => {
    props.onSelect(item);
  };

  /**
   * Listen to the layers and layers tree changes.
   */
  useEffect(() => {
    const updateLayers = () => {
      setLayersTree(model?.getLayersTree() || []);
    };
    model?.sharedModel?.layersChanged.connect(updateLayers);
    model?.sharedModel?.layersTreeChanged.connect(updateLayers);

    return () => {
      model?.sharedModel?.layersChanged.disconnect(updateLayers);
      model?.sharedModel?.layersTreeChanged.disconnect(updateLayers);
    };
  }, [model]);

  /**
   * Update the model when it changes.
   */
  props.model?.documentChanged.connect((_, widget) => {
    setModel(widget?.context.model);
    setLayersTree(widget?.context.model?.getLayersTree() || []);
  });

  return (
    <div>
      {layersTree.map(layer =>
        typeof layer === 'string' ? (
          <LayerComponent gisModel={model} layerId={layer} onClick={onItemClick} />
        ) : (
          <LayersGroupComponent
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
 * Properties of the layers group component.
 */
interface ILayersGroupProps {
  gisModel: IJupyterGISModel | undefined;
  group: IJGISLayersGroup | undefined;
  onClick: (item?: string) => void;
}

/**
 * The component to handle group of layers.
 */
function LayersGroupComponent(props: ILayersGroupProps): JSX.Element {
  const { group, gisModel } = props;
  if (group === undefined) {
    return <></>;
  }
  const [open, setOpen] = useState<boolean>(false);
  const name = group?.name ?? 'Undefined group';
  const layers = group?.layers ?? [];

  return (
    <div className={`${LAYER_ITEM_CLASS} ${LAYERS_GROUP_CLASS}`}>
      <div onClick={() => setOpen(!open)} className={LAYERS_GROUP_HEADER_CLASS}>
        <LabIcon.resolveReact
          icon={caretDownIcon}
          className={
            LAYERS_GROUP_COLLAPSER_CLASS + (open ? ' jp-mod-expanded' : '')
          }
          tag={'span'}
        />
        <span>{name}</span>
      </div>
      {open && (
        <div>
          {layers.map(layer =>
            typeof layer === 'string' ? (
              <LayerComponent
                gisModel={gisModel}
                layerId={layer}
                onClick={props.onClick}
              />
            ) : (
              <LayersGroupComponent
                gisModel={gisModel}
                group={layer}
                onClick={props.onClick}
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
  onClick: (item?: string) => void;
}

function isSelected(layerId: string, model: IJupyterGISModel | undefined) {
  return (
    (model?.localState?.selected?.value &&
      Object.keys(model?.localState?.selected?.value).includes(
        layerId
      )) ||
    false
  );
}

/**
 * The component to display a single layer.
 */
function LayerComponent(props: ILayerProps): JSX.Element {
  const { layerId, gisModel } = props;
  const layer = gisModel?.getLayer(layerId);
  if (layer === undefined) {
    return <></>;
  }
  const [selected, setSelected] = useState<boolean>(
    // TODO Support multi-selection as `model?.jGISModel?.localState?.selected.value` does
    isSelected(layerId, gisModel)
  );
  const name = layer.name;

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
      gisModel?.clientStateChanged.disconnect(
        onClientSharedStateChanged
      );
    };
  }, [gisModel]);

  /**
   * Toggle layer visibility.
   */
  const toggleVisibility = () => {
    layer.visible = !layer.visible;
    gisModel?.sharedModel?.updateLayer(layerId, layer);
  };

  return (
    <div
      className={`${LAYER_ITEM_CLASS} ${LAYER_CLASS}${selected ? ' jp-mod-selected' : ''}`}
    >
      <div className={LAYER_TITLE_CLASS} onClick={() => props.onClick(layerId)}>
        {layer.type === 'RasterLayer' && (
          <LabIcon.resolveReact
            icon={rasterIcon}
            className={LAYER_ICON_CLASS}
          />
        )}
        <span>{name}</span>
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
