import { IJGISLayer, IJGISLayerGroup, IJupyterGISModel } from '@jupytergis/schema';
import { ReactWidget } from '@jupyterlab/ui-components';
import { ISignal, Signal } from '@lumino/signaling';
import { Panel } from '@lumino/widgets';
import React, { useEffect, useState } from 'react';

export class LayersPanel extends Panel {
  constructor(options: LayersPanel.IOptions) {
    super();
    this._model = options.model;
    this.id = 'Layer tree';
    this.addWidget(
      ReactWidget.create(
        <LayersBody
          model={this._model}
          modelChanged={this._modelChanged}
        ></LayersBody>
      )
    );
  }

  set model(value: IJupyterGISModel | undefined) {
    this._model = value;
    this._modelChanged.emit(value);
  }

  modelChanged(): ISignal<LayersPanel, IJupyterGISModel | undefined> {
    return this._modelChanged;
  }

  private _model: IJupyterGISModel | undefined;
  private _modelChanged = new Signal<LayersPanel, IJupyterGISModel | undefined>(this);
}

export namespace LayersPanel {
  export interface IOptions {
    model: IJupyterGISModel | undefined;
  }
  export interface IBodyProps extends IOptions {
    modelChanged: ISignal<LayersPanel, IJupyterGISModel | undefined>;
  }
}

export function LayersBody(props: LayersPanel.IBodyProps): JSX.Element {
  const [model, setModel] = useState<IJupyterGISModel | undefined>(props.model);
  const [treeLayers, setTreeLayers] = useState<(string | IJGISLayerGroup)[]>(
    props.model?.getTreeLayers() || []
  );

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
          ? <LayerItem layer={model?.getLayer(layer)}/>
          : <LayerGroup group={layer}/>
      ))}
    </div>
  );
}

function LayerGroup(props: {group: IJGISLayerGroup}): JSX.Element {
  return <div>Layer group {props.group.name}</div>
}

function LayerItem(props: {layer: IJGISLayer | undefined}): JSX.Element {
  return <div>{props.layer?.name ?? 'undefined layer'}</div>;
}