import { IJGISLayer, IJGISLayerGroup, IJupyterGISModel } from '@jupytergis/schema';
import { LabIcon, ReactWidget, caretDownIcon } from '@jupyterlab/ui-components';
import { ISignal, Signal } from '@lumino/signaling';
import { Panel } from '@lumino/widgets';
import React, { useEffect, useState } from 'react';

const LAYERS_PANEL_CLASS = 'jp-gis-layerPanel';
const LAYERS_ENTRY_CLASS = 'jp-gis-layerEntry';
const LAYERS_GROUP_CLASS = 'jp-gis-layerGroup';
const LAYERS_GROUP_HEADER_CLASS = 'jp-gis-layerGroupHeader';
const LAYERS_GROUP_COLLAPSER_CLASS = 'jp-gis-layerGroupCollapser';
const LAYERS_ITEM_CLASS = 'jp-gis-layerItem';

export namespace LayersPanel {
  export interface IOptions {
    model: IJupyterGISModel | undefined;
  }
  export interface IBodyProps extends IOptions {
    modelChanged: ISignal<LayersPanel, IJupyterGISModel | undefined>;
    onSelect: (layer?: IJGISLayer) => void;
  }
  export interface ILayerGroupProps extends IOptions {
    group: IJGISLayerGroup | undefined;
    onClick: (item?: IJGISLayer) => void;
  }
  export interface ILayerItemProps extends IOptions {
    layer: IJGISLayer | undefined;
    onClick: (item?: IJGISLayer) => void;
  }
}

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

  set model(value: IJupyterGISModel | undefined) {
    this._model = value;
    this._modelChanged.emit(value);
  }

  get modelChanged(): ISignal<LayersPanel, IJupyterGISModel | undefined> {
    return this._modelChanged;
  }

  private _onSelect = (layer?: IJGISLayer) => {
    if (this._model) {
      this._model.currentLayer = layer ?? null;
    }
  };

  private _model: IJupyterGISModel | undefined;
  private _modelChanged = new Signal<LayersPanel, IJupyterGISModel | undefined>(this);
}

export function LayersBody(props: LayersPanel.IBodyProps): JSX.Element {
  const [model, setModel] = useState<IJupyterGISModel | undefined>(props.model);
  const [treeLayers, setTreeLayers] = useState<(string | IJGISLayerGroup)[]>(
    props.model?.getTreeLayers() || []
  );

  const onItemClick = (item?: IJGISLayer) => {
    props.onSelect(item);
  };

  useEffect(() => {
    const updateLayers = () => {
      setTreeLayers(model?.getTreeLayers() || []);
    }
    model?.sharedModel.layersChanged.connect(updateLayers);
    model?.sharedModel.layerTreeChanged.connect(updateLayers);

    return () => {
      model?.sharedModel.layersChanged.disconnect(updateLayers);
      model?.sharedModel.layerTreeChanged.disconnect(updateLayers);
    }
  }, [model])


  props.modelChanged.connect((_, model) => {
    setModel(model);
    setTreeLayers(model?.getTreeLayers() || []);
  });

  return (
    <div>
      {treeLayers.map(layer => (
        typeof layer === 'string'
          ? <LayerItem
              model={model}
              layer={model?.getLayer(layer)}
              onClick={onItemClick}
            />
          : <LayerGroup model={model} group={layer} onClick={onItemClick}/>
      ))}
    </div>
  );
}

function LayerGroup(props: LayersPanel.ILayerGroupProps): JSX.Element {
  const [open, setOpen] = useState<boolean>(false);
  const name = props.group?.name ?? 'Undefined group';
  const layers = props.group?.layers ?? [];

  return (
    <li className={`${LAYERS_ENTRY_CLASS} ${LAYERS_GROUP_CLASS}`}>
      <div onClick={() => setOpen(!open)} className={LAYERS_GROUP_HEADER_CLASS}>
        <LabIcon.resolveReact
          icon={caretDownIcon}
          className={
            LAYERS_GROUP_COLLAPSER_CLASS +
            (open ? ' jp-mod-expanded' : '')
          }
          tag={'span'}
        />
        <span>{name}</span>
      </div>
      {open && (
        <div>
          {layers.map(layer => (
            typeof layer === 'string'
              ? <LayerItem
                  model={props.model}
                  layer={props.model?.getLayer(layer)}
                  onClick={props.onClick}
                />
              : <LayerGroup model={props.model} group={layer} onClick={props.onClick}/>
          ))}
        </div>
      )}
    </li>
  );
}


function LayerItem(props: LayersPanel.ILayerItemProps): JSX.Element {
  if (props.layer === undefined) {
    return <></>;
  }
  const [selected, setSelected] = useState<boolean>(
    props.model?.currentLayer === props.layer
  );
  const name = props.layer.name;

  useEffect(() => {
    const isSelected = () => {
      setSelected(props.model?.currentLayer === props.layer);
    }
    props.model?.currentLayerChanged.connect(isSelected);

    return () => {
      props.model?.currentLayerChanged.disconnect(isSelected);
    }
  }, [])
  return (
    <li
      className={`${LAYERS_ENTRY_CLASS} ${LAYERS_ITEM_CLASS} ${selected ? 'jp-mod-selected' : ''}`}
      onClick={() => props.onClick(props.layer)}
    >
      <span>{name}</span>
    </li>
  );
}
