import { IJupyterGISModel, IVectorLayer } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { Button } from '@jupyterlab/ui-components';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import React, { useEffect, useRef, useState } from 'react';
import StopRow from './components/color-expression/StopRow';

interface IZoomColorProps {
  context: DocumentRegistry.IContext<IJupyterGISModel>;
  okSignalPromise: PromiseDelegate<Signal<ZoomColorWidget, null>>;
  cancel: () => void;
}

export interface IStopRow {
  value: number;
  color: any;
}

const ZoomColor = ({ context, okSignalPromise, cancel }: IZoomColorProps) => {
  const functions = ['interpolate'];
  const rowsRef = useRef<IStopRow[]>();
  const selectedLayerRef = useRef<string>('');
  const [selectedFunction, setSelectedFunction] = useState('interpolate');
  const [selectedLayer, setSelectedLayer] = useState('');
  const [stopRows, setStopRows] = useState<IStopRow[]>([]);

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

  useEffect(() => {
    // This it to parse a color object on the layer
    console.log('starting');
    selectedLayerRef.current = selectedLayer;

    const layer = context.model.getLayer(selectedLayer);
    console.log('selectedLayer', selectedLayer);
    if (!layer || !layer.parameters?.color) {
      return;
    }

    const color = layer.parameters.color;

    // If color is a string we don't need to parse
    if (typeof color === 'string') {
      return;
    }
    const pairedObjects: IStopRow[] = [];

    // So if it's not a string then it's an array and we parse
    // First element is function (ie interpolate)
    // Second element is type of interpolation (ie linear)
    // Third is ...something idk what, the NVDI for testing
    // Fourth and on is value:color pairs
    for (let i = 3; i < color.length; i += 2) {
      const obj: IStopRow = {
        value: color[i],
        color: color[i + 1]
      };
      pairedObjects.push(obj);
    }

    setStopRows(pairedObjects);
    console.log('pairedObjects', pairedObjects);
  }, [selectedLayer]);

  useEffect(() => {
    console.log('stopRows', stopRows);
    rowsRef.current = stopRows;
  }, [stopRows]);

  const handleOk = () => {
    const layer = context.model.getLayer(selectedLayer);
    // console.log('selectedLayer', selectedLayer);
    if (!layer || !layer.parameters) {
      return;
    }

    const colorExpr: any = [selectedFunction, ['linear']];

    // console.log('stopRows', stopRows);
    // console.log('rowsRef.current', rowsRef.current);

    const nir = ['band', 2];

    // near-infrared is the first band from above
    const red = ['band', 1];

    const difference = ['-', nir, red];
    const sum = ['+', nir, red];

    const ndvi = ['/', difference, sum];
    colorExpr.push(ndvi);

    rowsRef.current?.map(stop => {
      colorExpr.push(stop.value);
      colorExpr.push(stop.color);
    });

    // colorExpr.push(-0.2); // ndvi values <= -0.2 will get the color below
    // colorExpr.push([191, 191, 191]);
    // colorExpr.push(0); // ndvi values between -0.2 and 0 will get an interpolated color between the one above and the one below
    // colorExpr.push([255, 255, 224]);
    // colorExpr.push(0.2);
    // colorExpr.push([145, 191, 82]);
    // colorExpr.push(0.4);
    // colorExpr.push([79, 138, 46]);
    // colorExpr.push(0.6);
    // colorExpr.push([15, 84, 10]);

    // console.log('colorExpr', colorExpr);

    // console.log('safe');

    (layer.parameters as IVectorLayer).color = colorExpr;
    context.model.sharedModel.updateLayer(selectedLayerRef.current, layer);
    cancel();
  };

  okSignalPromise.promise.then(okSignal => {
    okSignal.connect(handleOk);
  });

  const addStopRow = () => {
    setStopRows([
      ...stopRows,
      {
        value: 0,
        color: [0, 0, 0]
      }
    ]);
  };

  return (
    <div className="jp-gis-color-container">
      <div className="funcion select">
        <label htmlFor="function-select">Function</label>
        <select
          name="function-select"
          id="function-select"
          onChange={event => {
            setSelectedFunction(event.target.value);
          }}
        >
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
          <span style={{ flex: '0 0 18%' }}>Value</span>
          <span>Output Value</span>
        </div>
        {stopRows.map((stop, index) => (
          <StopRow
            index={index}
            value={stop.value}
            outputValue={stop.color}
            stopRows={stopRows}
            setStopRows={setStopRows}
          />
        ))}
      </div>
      <div className="bottom buttons">
        <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          onClick={addStopRow}
        >
          Add Stop
        </Button>
        {/* <Button onClick={handleSubmit}>Submit</Button> */}
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

    super({ title: 'Color Expression', body });

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
