import { GeoJSONFeature1 } from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import colormap from 'colormap';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';
import { VectorClassifications } from '../../../classificationModes';
import { IStopRow, ISymbologyDialogProps } from '../../symbologyDialog';
import ColorRamp from './ColorRamp';
import StopRow from './StopRow';

const Graduated = ({
  context,
  state,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const modeOptions = [
    'quantile',
    'equal interval',
    'jenks',
    'pretty',
    'logarithmic'
  ];

  const selectedValueRef = useRef<string>();
  const selectedMethodRef = useRef<string>();
  const stopRowsRef = useRef<IStopRow[]>();
  const layerStateRef = useRef<ReadonlyPartialJSONObject | undefined>();

  const [selectedValue, setSelectedValue] = useState('');
  const [featureProperties, setFeatureProperties] = useState<any>({});
  const [selectedMethod, setSelectedMethod] = useState('color');
  const [stopRows, setStopRows] = useState<IStopRow[]>([]);
  const [methodOptions, setMethodOptions] = useState<string[]>(['color']);
  const [layerState, setLayerState] = useState<
    ReadonlyPartialJSONObject | undefined
  >();

  if (!layerId) {
    return;
  }
  const layer = context.model.getLayer(layerId);
  if (!layer?.parameters) {
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
      });
    };

    getProperties();
    buildColorInfo();

    okSignalPromise.promise.then(okSignal => {
      okSignal.connect(handleOk, this);
    });

    return () => {
      okSignalPromise.promise.then(okSignal => {
        okSignal.disconnect(handleOk, this);
      });
    };
  }, []);

  useEffect(() => {
    selectedValueRef.current = selectedValue;
    selectedMethodRef.current = selectedMethod;
    stopRowsRef.current = stopRows;
    layerStateRef.current = layerState;
  }, [selectedValue, selectedMethod, stopRows, layerState]);

  useEffect(() => {
    populateOptions();
  }, [featureProperties]);

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

    const prefix = layer.parameters.type === 'circle' ? 'circle-' : '';
    if (!color[`${prefix}fill-color`]) {
      return;
    }

    const valueColorPairs: IStopRow[] = [];

    // So if it's not a string then it's an array and we parse
    // Color[0] is the operator used for the color expression
    switch (color[`${prefix}fill-color`][0]) {
      case 'interpolate': {
        // First element is interpolate for linear selection
        // Second element is type of interpolation (ie linear)
        // Third is input value that stop values are compared with
        // Fourth and on is value:color pairs
        for (let i = 3; i < color[`${prefix}fill-color`].length; i += 2) {
          const obj: IStopRow = {
            stop: color[`${prefix}fill-color`][i],
            output: color[`${prefix}fill-color`][i + 1]
          };
          valueColorPairs.push(obj);
        }
        break;
      }
    }

    setStopRows(valueColorPairs);
  };

  const populateOptions = async () => {
    // Set up method options
    if (layer?.parameters?.type === 'circle') {
      const options = ['color', 'radius'];
      setMethodOptions(options);
    }

    const layerState = await state.fetch(`jupytergis:${layerId}`);

    let value, method;

    if (layerState) {
      value = (layerState as ReadonlyPartialJSONObject)
        .graduatedValue as string;
      method = (layerState as ReadonlyPartialJSONObject)
        .graduatedMethod as string;
    }

    setLayerState(layerState as ReadonlyPartialJSONObject);
    setSelectedValue(value ? value : Object.keys(featureProperties)[0]);
    setSelectedMethod(method ? method : 'color');
  };

  const handleOk = () => {
    if (!layer.parameters) {
      return;
    }

    state.save(`jupytergis:${layerId}`, {
      ...layerStateRef.current,
      renderType: 'Graduated',
      graduatedValue: selectedValueRef.current,
      graduatedMethod: selectedMethodRef.current
    });

    const colorExpr: ExpressionValue[] = [];
    colorExpr.push('interpolate');
    colorExpr.push(['linear']);
    colorExpr.push(['get', selectedValueRef.current]);

    stopRowsRef.current?.map(stop => {
      colorExpr.push(stop.stop);
      colorExpr.push(stop.output);
    });

    const newStyle = { ...layer.parameters.color };

    if (selectedMethodRef.current === 'color') {
      if (layer.parameters.type === 'fill') {
        newStyle['fill-color'] = colorExpr;
      }

      if (layer.parameters.type === 'line') {
        newStyle['stroke-color'] = colorExpr;
      }

      if (layer.parameters.type === 'circle') {
        newStyle['circle-fill-color'] = colorExpr;
      }
    }

    if (selectedMethodRef.current === 'radius') {
      if (layer.parameters.type === 'circle') {
        newStyle['circle-radius'] = colorExpr;
      }
    }

    layer.parameters.color = newStyle;

    context.model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  const addStopRow = () => {
    setStopRows([
      {
        stop: 0,
        output: [0, 0, 0, 1]
      },
      ...stopRows
    ]);
  };

  const deleteStopRow = (index: number) => {
    const newFilters = [...stopRows];
    newFilters.splice(index, 1);

    setStopRows(newFilters);
  };

  const buildColorInfoFromClassification = (
    selectedMode: string,
    numberOfShades: string,
    selectedRamp: string
  ) => {
    let stops;

    const values = featureProperties[selectedValue];

    switch (selectedMode) {
      case 'quantile':
        stops = VectorClassifications.calculateQuantileBreaks(
          values,
          +numberOfShades
        );
        break;
      case 'equal interval':
        stops = VectorClassifications.calculateEqualIntervalBreaks(
          values,
          +numberOfShades
        );
        break;
      case 'jenks':
        stops = VectorClassifications.calculateJenksBreaks(
          values,
          +numberOfShades
        );
        break;
      case 'pretty':
        stops = VectorClassifications.calculatePrettyBreaks(
          values,
          +numberOfShades
        );
        break;
      case 'logarithmic':
        stops = VectorClassifications.calculateLogarithmicBreaks(
          values,
          +numberOfShades
        );
        break;
      default:
        console.warn('No mode selected');
        return;
    }

    const colorMap = colormap({
      colormap: selectedRamp,
      nshades: +numberOfShades,
      format: 'rgba'
    });

    const valueColorPairs: IStopRow[] = [];

    // assume stops and colors are same length
    for (let i = 0; i < +numberOfShades; i++) {
      valueColorPairs.push({ stop: stops[i], output: colorMap[i] });
    }

    setStopRows(valueColorPairs);
  };

  return (
    <div className="jp-gis-layer-symbology-container">
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Value:</label>
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
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-method-select'}>Method:</label>
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
      <ColorRamp
        layerId={layerId}
        modeOptions={modeOptions}
        classifyFunc={buildColorInfoFromClassification}
      />
      <div className="jp-gis-stop-container">
        <div className="jp-gis-stop-labels" style={{ display: 'flex', gap: 6 }}>
          <span style={{ flex: '0 0 18%' }}>Value</span>
          <span>Output Value</span>
        </div>
        {stopRows.map((stop, index) => (
          <StopRow
            key={`${index}-${stop.output}`}
            index={index}
            value={stop.stop}
            outputValue={stop.output}
            stopRows={stopRows}
            setStopRows={setStopRows}
            deleteRow={() => deleteStopRow(index)}
            useNumber={selectedMethod === 'radius' ? true : false}
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
        {/* <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          onClick={buildColorInfoFromClassification}
        >
          Classify
        </Button> */}
      </div>
    </div>
  );
};

export default Graduated;
