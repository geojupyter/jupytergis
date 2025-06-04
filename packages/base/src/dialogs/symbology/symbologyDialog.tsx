import { IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { IStateDB } from '@jupyterlab/statedb';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import React, { useEffect, useState } from 'react';

import { SymbologyTab } from '@/src/types';
import TiffRendering from './tiff_layer/TiffRendering';
import VectorRendering from './vector_layer/VectorRendering';

export interface ISymbologyDialogProps {
  model: IJupyterGISModel;
  state: IStateDB;
  okSignalPromise: PromiseDelegate<Signal<SymbologyWidget, null>>;
  cancel: () => void;
  layerId?: string;
}

export interface ISymbologyTabbedDialogProps extends ISymbologyDialogProps {
  symbologyTab: SymbologyTab;
}

export interface ISymbologyWidgetOptions {
  model: IJupyterGISModel;
  state: IStateDB;
}

export interface IStopRow {
  stop: number;
  output: number | number[];
}

const SymbologyDialog = ({
  model,
  state,
  okSignalPromise,
  cancel,
}: ISymbologyDialogProps) => {
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [componentToRender, setComponentToRender] = useState<any>(null);

  let LayerSymbology: React.JSX.Element;

  useEffect(() => {
    const handleClientStateChanged = () => {
      if (!model.localState?.selected?.value) {
        return;
      }

      const currentLayer = Object.keys(model.localState.selected.value)[0];

      setSelectedLayer(currentLayer);
    };

    // Initial state
    handleClientStateChanged();

    model.clientStateChanged.connect(handleClientStateChanged);

    return () => {
      model.clientStateChanged.disconnect(handleClientStateChanged);
    };
  }, []);

  useEffect(() => {
    if (!selectedLayer) {
      return;
    }

    const layer = model.getLayer(selectedLayer);

    if (!layer) {
      return;
    }

    // TODO WebGlLayers can also be used for other layers, need a better way to determine source + layer combo
    switch (layer.type) {
      case 'VectorLayer':
      case 'VectorTileLayer':
      case 'HeatmapLayer':
        LayerSymbology = (
          <VectorRendering
            model={model}
            state={state}
            okSignalPromise={okSignalPromise}
            cancel={cancel}
            layerId={selectedLayer}
          />
        );
        break;
      case 'WebGlLayer':
        LayerSymbology = (
          <TiffRendering
            model={model}
            state={state}
            okSignalPromise={okSignalPromise}
            cancel={cancel}
            layerId={selectedLayer}
          />
        );
        break;
      default:
        LayerSymbology = <div>Layer Type Not Supported</div>;
    }
    setComponentToRender(LayerSymbology);
  }, [selectedLayer]);

  return <>{componentToRender}</>;
};

export class SymbologyWidget extends Dialog<boolean> {
  private okSignal: Signal<SymbologyWidget, null>;

  constructor(options: ISymbologyWidgetOptions) {
    const cancelCallback = () => {
      this.resolve(0);
    };

    const okSignalPromise = new PromiseDelegate<
      Signal<SymbologyWidget, null>
    >();

    const body = (
      <SymbologyDialog
        model={options.model}
        okSignalPromise={okSignalPromise}
        cancel={cancelCallback}
        state={options.state}
      />
    );

    super({ title: 'Symbology', body });

    this.id = 'jupytergis::symbologyWidget';

    this.okSignal = new Signal(this);
    okSignalPromise.resolve(this.okSignal);

    this.addClass('jp-gis-symbology-dialog');
  }

  resolve(index: number): void {
    if (index === 0) {
      super.resolve(index);
    }

    if (index === 1) {
      this.okSignal.emit(null);
    }
  }
}

export default SymbologyWidget;
