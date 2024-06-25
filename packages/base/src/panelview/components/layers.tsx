import {IJGISLayerGroup, IJupyterGISModel} from '@jupytergis/schema';
import { Button, LabIcon, ReactWidget, caretDownIcon } from '@jupyterlab/ui-components';
import { ISignal, Signal } from '@lumino/signaling';
import { Panel } from '@lumino/widgets';
import React, { useEffect, useState } from 'react';
import { nonVisibilityIcon, rasterIcon, visibilityIcon } from '../../icons';

const LAYERS_PANEL_CLASS = 'jp-gis-layerPanel';
const LAYERS_ENTRY_CLASS = 'jp-gis-layerEntry';
const LAYERS_GROUP_CLASS = 'jp-gis-layerGroup';
const LAYERS_GROUP_HEADER_CLASS = 'jp-gis-layerGroupHeader';
const LAYERS_GROUP_COLLAPSER_CLASS = 'jp-gis-layerGroupCollapser';
const LAYERS_ITEM_CLASS = 'jp-gis-layerItem';
const LAYERS_ITEM_TITLE_CLASS = 'jp-gis-layerItemTitle';
const LAYERS_ICON_CLASS = 'jp-gis-layerIcon';

/**
 * The namespace for the layer panel.
 */
export namespace LayersPanel {
  /**
   * Options of the layer panel widget.
   */
  export interface IOptions {
    model: IJupyterGISModel | undefined;
  }
  /**
   * Properties of the layer body component.
   */
  export interface IBodyProps extends IOptions {
    modelChanged: ISignal<LayersPanel, IJupyterGISModel | undefined>;
    onSelect: (layer?: string) => void;
  }
  /**
   * Properties of the layer group component.
   */
  export interface ILayerGroupProps extends IOptions {
    group: IJGISLayerGroup | undefined;
    onClick: (item?: string) => void;
  }
  /**
   * Properties of the layer item component.
   */
  export interface ILayerItemProps extends IOptions {
    layerId: string;
    onClick: (item?: string) => void;
  }
}

/**
 * The layer panel widget.
 */
export class LayersPanel extends Panel {
  constructor(options: LayersPanel.IOptions) {
    super();
    this._model = options.model;
    this.id = 'Layer tree';
    this.addClass(LAYERS_PANEL_CLASS);
    this.addWidget(
      ReactWidget.create(
        <LayersBody
          model={this._model}
          modelChanged={this._modelChanged}
          onSelect={this._onSelect}
        ></LayersBody>
      )
    );
  }

  /**
   * Set the GIS model associated to the widget.
   */
  set model(value: IJupyterGISModel | undefined) {
    this._model = value;
    this._modelChanged.emit(value);
  }

  /**
   * A signal emitting when the GIS model changed.
   */
  get modelChanged(): ISignal<LayersPanel, IJupyterGISModel | undefined> {
    return this._modelChanged;
  }

  /**
   * Function to call when a layer is selected from a component of the panel.
   *
   * @param layer - the selected layer.
   */
  private _onSelect = (layer?: string) => {
    if (this._model) {
      this._model.currentLayer = layer ?? null;
    }
  };

  private _model: IJupyterGISModel | undefined;
  private _modelChanged = new Signal<LayersPanel, IJupyterGISModel | undefined>(
    this
  );
}

/**
 * The body component of the panel.
 */
export function LayersBody(props: LayersPanel.IBodyProps): JSX.Element {
  const [model, setModel] = useState<IJupyterGISModel | undefined>(props.model);
  const [treeLayers, setTreeLayers] = useState<(string | IJGISLayerGroup)[]>(
    props.model?.getTreeLayers() || []
  );

  /**
   * Propagate the layer selection.
   */
  const onItemClick = (item?: string) => {
    props.onSelect(item);
  };

  /**
   * Listen to the layers and layer tree changes.
   */
  useEffect(() => {
    const updateLayers = () => {
      setTreeLayers(model?.getTreeLayers() || []);
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
  props.modelChanged.connect((_, model) => {
    setModel(model);
    setTreeLayers(model?.getTreeLayers() || []);
  });

  return (
    <div>
      {treeLayers.map(layer =>
        typeof layer === 'string' ? (
          <LayerItem
            model={model}
            layerId={layer}
            onClick={onItemClick}
          />
        ) : (
          <LayerGroup model={model} group={layer} onClick={onItemClick} />
        )
      )}
    </div>
  );
}

/**
 * The component to handle group of layers.
 */
function LayerGroup(props: LayersPanel.ILayerGroupProps): JSX.Element {
  const { group, model } = props;
  if (group === undefined) {
    return <></>;
  }
  const [open, setOpen] = useState<boolean>(false);
  const name = group?.name ?? 'Undefined group';
  const layers = group?.layers ?? [];

  return (
    <div className={`${LAYERS_ENTRY_CLASS} ${LAYERS_GROUP_CLASS}`}>
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
              <LayerItem
                model={model}
                layerId={layer}
                onClick={props.onClick}
              />
            ) : (
              <LayerGroup
                model={model}
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
 * The component to display a single layer.
 */
function LayerItem(props: LayersPanel.ILayerItemProps): JSX.Element {
  const { layerId, model } = props;
  const layer = model?.getLayer(layerId);
  if (layer === undefined) {
    return <></>;
  }
  const [selected, setSelected] = useState<boolean>(
    model?.currentLayer === layerId
  );
  const name = layer.name;

  /**
   * Listen to the changes on the current layer.
   */
  useEffect(() => {
    const isSelected = () => {
      setSelected(model?.currentLayer === layerId);
    };
    model?.currentLayerChanged.connect(isSelected);

    return () => {
      model?.currentLayerChanged.disconnect(isSelected);
    };
  }, [model]);

  /**
   * Toggle layer visibility.
   */
  const toggleVisibility = () => {
    layer.visible = !layer.visible;
    model?.sharedModel.updateLayer(layerId, layer);
  }

  return (
    <div
      className={`${LAYERS_ENTRY_CLASS} ${LAYERS_ITEM_CLASS} ${selected ? 'jp-mod-selected' : ''}`}
    >
      <div className={LAYERS_ITEM_TITLE_CLASS} onClick={() => props.onClick(layerId)}>
        {layer.type === 'RasterLayer' && (
          <LabIcon.resolveReact icon={rasterIcon} className={LAYERS_ICON_CLASS} />
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
          className={LAYERS_ICON_CLASS}
          tag='span'
        />
      </Button>
    </div>
  );
}
