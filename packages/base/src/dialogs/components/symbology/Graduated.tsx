import { GeoJSONFeature1 } from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';
import { IStopRow, ISymbologyDialogProps } from '../../symbologyDialog';
import StopRow from './StopRow';

const Graduated = ({
  context,
  state,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const selectedValueRef = useRef<string>();
  const stopRowsRef = useRef<IStopRow[]>();

  const [selectedValue, setSelectedValue] = useState('');
  const [featureProperties, setFeatureProperties] = useState<any>({});
  const [selectedMethod, setSelectedMethod] = useState('color');
  const [stopRows, setStopRows] = useState<IStopRow[]>([]);

  const methodOptions = ['color', 'size'];

  if (!layerId) {
    return;
  }
  const layer = context.model.getLayer(layerId);
  if (!layer) {
    return;
  }

  useEffect(() => {
    const getProperties = async () => {
      if (!layerId) {
        return;
      }
      const model = context.model;

      const layer = model.getLayer(layerId);

      const source = model.getSource(layer?.parameters?.source);

      if (!source) {
        return;
      }

      const data = await model.readGeoJSON(source.parameters?.path);
      const featureProps: any = {};

      data?.features.forEach((feature: GeoJSONFeature1) => {
        feature.properties &&
          Object.entries(feature.properties).forEach(([key, value]) => {
            if (!(key in featureProps)) {
              featureProps[key] = new Set();
            }

            featureProps[key].add(value);
          });

        setFeatureProperties(featureProps);
        setSelectedValue(Object.keys(featureProps)[0]);
        //   addFeatureValue(feature.properties, aggregatedProperties);
      });
    };

    getProperties();
    buildColorInfo();
  }, []);

  useEffect(() => {
    console.log('selectedValue', selectedValue);
    selectedValueRef.current = selectedValue;
  }, [selectedValue]);

  useEffect(() => {
    stopRowsRef.current = stopRows;
  }, [stopRows]);

  const buildColorInfo = () => {
    // This it to parse a color object on the layer
    if (!layer.parameters?.color) {
      return;
    }

    const color = layer.parameters.color;

    // If color is a string we don't need to parse
    if (typeof color === 'string') {
      return;
    }
    const valueColorPairs: IStopRow[] = [];

    // So if it's not a string then it's an array and we parse
    // Color[0] is the operator used for the color expression
    switch (color[0]) {
      case 'interpolate': {
        // First element is interpolate for linear selection
        // Second element is type of interpolation (ie linear)
        // Third is input value that stop values are compared with
        // Fourth and on is value:color pairs
        for (let i = 3; i < color.length; i += 2) {
          const obj: IStopRow = {
            value: color[i],
            color: color[i + 1]
          };
          valueColorPairs.push(obj);
        }
        break;
      }
    }

    setStopRows(valueColorPairs);
  };

  const handleOk = () => {
    // 'circle-fill-color': [
    //   'interpolate',
    //   ['linear'],
    //   ['get', 'pop_max'],
    //   1_000_000,
    //   'hsl(210 100% 40% / 0.9)',
    //   10_000_000,
    //   'hsl(0 80% 60% / 0.9)',
    // ],

    if (!layer.parameters) {
      return;
    }

    const colorExpr: ExpressionValue[] = [];
    // TODO: type of color should be based on something
    colorExpr.push('interpolate');
    colorExpr.push(['linear']);
    colorExpr.push(['get', selectedValueRef.current]);

    stopRowsRef.current?.map(stop => {
      colorExpr.push(stop.value);
      colorExpr.push(stop.color);
    });

    layer.parameters.color = colorExpr;

    context.model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  okSignalPromise.promise.then(okSignal => {
    okSignal.connect(handleOk);
  });

  const addStopRow = () => {
    setStopRows([
      {
        value: 0,
        color: [0, 0, 0, 1]
      },
      ...stopRows
    ]);
  };

  const deleteStopRow = (index: number) => {
    const newFilters = [...stopRows];
    newFilters.splice(index, 1);

    setStopRows(newFilters);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Value:</label>
        <div className="jp-select-wrapper">
          <select
            name={'vector-value-select'}
            onChange={event => setSelectedValue(event.target.value)}
            className="jp-mod-styled"
          >
            {Object.keys(featureProperties).map((feature, index) => (
              <option
                key={index}
                value={feature}
                selected={feature === selectedValue}
                className="jp-mod-styled"
              >
                {feature}
              </option>
            ))}
          </select>
        </div>
      </div>
      <span>symbol</span>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-method-select'}>Method:</label>
        <div className="jp-select-wrapper">
          <select
            name={'vector-method-select'}
            onChange={event => setSelectedMethod(event.target.value)}
            className="jp-mod-styled"
          >
            {methodOptions.map((method, index) => (
              <option
                key={index}
                value={method}
                selected={method === selectedMethod}
                className="jp-mod-styled"
              >
                {method}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="jp-gis-stop-container">
        <div className="jp-gis-stop-labels" style={{ display: 'flex', gap: 6 }}>
          <span style={{ flex: '0 0 18%' }}>Value</span>
          <span>Output Value</span>
        </div>
        {stopRows.map((stop, index) => (
          <StopRow
            key={`${index}-${stop.color}`}
            index={index}
            value={stop.value}
            outputValue={stop.color}
            stopRows={stopRows}
            setStopRows={setStopRows}
            deleteRow={() => deleteStopRow(index)}
          />
        ))}
      </div>
      <div className="jp-gis-symbology-button-container">
        <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          onClick={addStopRow}
        >
          Add Stop
        </Button>
      </div>
    </div>
  );
};

export default Graduated;
