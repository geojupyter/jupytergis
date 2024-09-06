import { IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { IStateDB } from '@jupyterlab/statedb';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';

import React, { useEffect, useState } from 'react';
import BandRendering from './components/symbology/BandRendering';
export interface ISymbologyDialogProps {
  context: DocumentRegistry.IContext<IJupyterGISModel>;
  state: IStateDB;
  okSignalPromise: PromiseDelegate<Signal<SymbologyWidget, null>>;
  cancel: () => void;
  layerId?: string;
}

export interface ISymbologyWidgetOptions {
  context: DocumentRegistry.IContext<IJupyterGISModel>;
  state: IStateDB;
}

const SymbologyDialog = ({
  context,
  state,
  okSignalPromise,
  cancel
}: ISymbologyDialogProps) => {
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [componentToRender, setComponentToRender] = useState<any>(null);

  let LayerSymbology: React.JSX.Element;

  useEffect(() => {
    const handleClientStateChanged = () => {
      if (!context.model.localState?.selected?.value) {
        return;
      }

      const currentLayer = Object.keys(
        context.model.localState.selected.value
      )[0];

      setSelectedLayer(currentLayer);
    };

    // Initial state
    handleClientStateChanged();

    context.model.clientStateChanged.connect(handleClientStateChanged);

    return () => {
      context.model.clientStateChanged.disconnect(handleClientStateChanged);
    };
  }, []);

  useEffect(() => {
    if (!selectedLayer) {
      return;
    }

    const layer = context.model.getLayer(selectedLayer);

    if (!layer) {
      return;
    }

    // TODO WebGlLayers can also be used for other layers, need a better way to determine source + layer combo
    switch (layer.type) {
      case 'WebGlLayer':
        LayerSymbology = (
          <BandRendering
            context={context}
            state={state}
            okSignalPromise={okSignalPromise}
            cancel={cancel}
            layerId={selectedLayer}
          />
        );
        break;
      default:
        LayerSymbology = <div>Layer Not Supported</div>;
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
        context={options.context}
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
