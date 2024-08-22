import { IJupyterGISModel, IVectorLayer } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { Button } from '@jupyterlab/ui-components';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import React, { useEffect, useState } from 'react';
import StopRow from './components/zoom-color/StopRow';

interface IZoomColorProps {
  context: DocumentRegistry.IContext<IJupyterGISModel>;
  okSignalPromise: PromiseDelegate<Signal<ZoomColorWidget, null>>;
  cancel: () => void;
}

export interface IStopRow {
  zoom: number;
  outputValue: string;
}

const ZoomColor = ({ context, okSignalPromise, cancel }: IZoomColorProps) => {
  const functions = ['interpolate'];
  const [selectedFunction, setSelectedFunction] = useState('interpolate');
  const [selectedLayer, setSelectedLayer] = useState('');
  const [stopRows, setStopRows] = useState<IStopRow[]>([
    { zoom: 6, outputValue: 'rgba(178, 234, 167, 1)' },
    { zoom: 10, outputValue: 'rgba(24, 55, 59, 1)' }
  ]);

  useEffect(() => {
    const handleClientStateChanged = () => {
      if (!context.model.localState?.selected?.value) {
        return;
      }

      // TODO: handle multi select better
      const currentLayer = Object.keys(
        context.model.localState?.selected?.value
      )[0];

      setSelectedLayer(currentLayer);
    };

    // set the layer on initial render
    handleClientStateChanged();

    context.model.clientStateChanged.connect(handleClientStateChanged);
  }, []);

  // Handler for changing the number input
  //   const handleExaggerationChange = (event: ChangeEvent<HTMLInputElement>) => {
  //     setExaggerationInput(Number(event.target.value));
  //   };

  //   const handleOk = () => {
  //     context.model.setTerrain({
  //       source: selectedSourceRef.current,
  //       exaggeration: exaggerationInputRef.current
  //     });
  //     cancel();
  //   };

  //   okSignalPromise.promise.then(okSignal => {
  //     okSignal.connect(handleOk);
  //   });

  const handleSubmit = () => {
    const layer = context.model.getLayer(selectedLayer);
    console.log('selectedLayer', selectedLayer);
    if (!layer || !layer.parameters) {
      return;
    }

    const colorExpr: (string | number | string[])[] = [
      selectedFunction,
      ['linear'],
      ['zoom']
    ];

    stopRows.map(stop => {
      colorExpr.push(stop.zoom);
      colorExpr.push(stop.outputValue);
    });
    console.log('colorExpr', colorExpr);

    console.log('safe');

    (layer.parameters as IVectorLayer).color = colorExpr;
    context.model.sharedModel.updateLayer(
      'af61fe08-4969-4546-a407-f7840c9c2f5f',
      layer
    );
  };

  return (
    <div className="jp-gis-color-container">
      <div className="funcion select">
        <label htmlFor="function-select">Function</label>
        <select name="function-select" id="function-select">
          {functions.map((func, funcIndex) => (
            <option key={func} value={func}>
              {func}
            </option>
          ))}
        </select>
      </div>
      {/* <div className="base">Placeholder</div> */}
      <div className="stop container">
        <div className="labels" style={{ display: 'flex', gap: 6 }}>
          <span style={{ flex: '0 0 18%' }}>Zoom</span>
          <span>Output Value</span>
        </div>
        {stopRows.map((stop, index) => (
          <StopRow
            index={index}
            zoom={stop.zoom}
            outputValue={stop.outputValue}
            setStopRows={setStopRows}
          />
        ))}
      </div>
      <div className="bottom buttons">
        <Button className="jp-Dialog-button jp-mod-accept jp-mod-styled">
          Add Stop
        </Button>
        <Button onClick={handleSubmit}>Submit</Button>
      </div>
    </div>
  );
};

export interface IZoomColorOptions {
  context: DocumentRegistry.IContext<IJupyterGISModel>;
}

export class ZoomColorWidget extends Dialog<boolean> {
  private okSignal: Signal<ZoomColorWidget, null>;

  constructor(options: IZoomColorOptions) {
    const cancelCallback = () => {
      this.resolve(0);
    };

    const okSignalPromise = new PromiseDelegate<
      Signal<ZoomColorWidget, null>
    >();

    const body = (
      <ZoomColor
        context={options.context}
        okSignalPromise={okSignalPromise}
        cancel={cancelCallback}
      />
    );

    super({ title: 'Zoom Color', body });

    this.id = 'jupytergis::zoomzoom';

    this.okSignal = new Signal(this);
    okSignalPromise.resolve(this.okSignal);
  }

  resolve(index?: number): void {
    if (index === 0) {
      super.resolve(index);
    }

    if (index === 1) {
      this.okSignal.emit(null);
    }
  }
}

export default ZoomColor;
