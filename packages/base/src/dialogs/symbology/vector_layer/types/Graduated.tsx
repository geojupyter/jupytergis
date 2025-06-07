import { IVectorLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';

import { VectorClassifications } from '@/src/dialogs/symbology/classificationModes';
import ColorRamp, {
  ColorRampOptions,
} from '@/src/dialogs/symbology/components/color_ramp/ColorRamp';
import StopContainer from '@/src/dialogs/symbology/components/color_stops/StopContainer';
import {
  IStopRow,
  ISymbologyDialogWithAttributesProps,
} from '@/src/dialogs/symbology/symbologyDialog';
import { Utils, VectorUtils } from '@/src/dialogs/symbology/symbologyUtils';
import ValueSelect from '@/src/dialogs/symbology/vector_layer/components/ValueSelect';

const Graduated = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId,
  selectableAttributesAndValues,
}: ISymbologyDialogWithAttributesProps) => {
  const modeOptions = [
    'quantile',
    'equal interval',
    'jenks',
    'pretty',
    'logarithmic',
  ];

  const selectedValueRef = useRef<string>();
  const selectedMethodRef = useRef<string>();
  const stopRowsRef = useRef<IStopRow[]>();
  const colorRampOptionsRef = useRef<ColorRampOptions | undefined>();

  const [selectedValue, setSelectedValue] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('color');
  const [stopRows, setStopRows] = useState<IStopRow[]>([]);
  const [methodOptions, setMethodOptions] = useState<string[]>(['color']);
  const [colorRampOptions, setColorRampOptions] = useState<
    ColorRampOptions | undefined
  >();

  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  useEffect(() => {
    let stopOutputPairs: IStopRow[] = [];
    const layerParams = layer.parameters as IVectorLayer;
    const method = layerParams.symbologyState?.method ?? 'color';

    if (method === 'color') {
      stopOutputPairs = VectorUtils.buildColorInfo(layer);
    }

    if (method === 'radius') {
      stopOutputPairs = VectorUtils.buildRadiusInfo(layer);
    }
    updateStopRowsBasedOnMethod();

    setStopRows(stopOutputPairs);

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
    updateStopRowsBasedOnMethod();
  }, [selectedMethod]);

  useEffect(() => {
    selectedValueRef.current = selectedValue;
    selectedMethodRef.current = selectedMethod;
    stopRowsRef.current = stopRows;
    colorRampOptionsRef.current = colorRampOptions;
  }, [selectedValue, selectedMethod, stopRows, colorRampOptions]);

  useEffect(() => {
    // Set up method options
    if (layer?.parameters?.type === 'circle') {
      const options = ['color', 'radius'];
      setMethodOptions(options);
    }

    const layerParams = layer.parameters as IVectorLayer;
    const value =
      layerParams.symbologyState?.value ??
      Object.keys(selectableAttributesAndValues)[0];
    const method = layerParams.symbologyState?.method ?? 'color';

    setSelectedValue(value);
    setSelectedMethod(method);
  }, [selectableAttributesAndValues]);

  const updateStopRowsBasedOnMethod = () => {
    if (!layer) {
      return;
    }

    let stopOutputPairs: IStopRow[] = [];

    if (selectedMethod === 'color') {
      stopOutputPairs = VectorUtils.buildColorInfo(layer);
    }

    if (selectedMethod === 'radius') {
      stopOutputPairs = VectorUtils.buildRadiusInfo(layer);
    }

    setStopRows(stopOutputPairs);
  };

  const handleOk = () => {
    if (!layer.parameters) {
      return;
    }

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
      newStyle['fill-color'] = colorExpr;

      newStyle['stroke-color'] = colorExpr;

      newStyle['circle-fill-color'] = colorExpr;
    }

    if (selectedMethodRef.current === 'radius') {
      newStyle['circle-radius'] = colorExpr;
    }

    const symbologyState = {
      renderType: 'Graduated',
      value: selectedValueRef.current,
      method: selectedMethodRef.current,
      colorRamp: colorRampOptionsRef.current?.selectedRamp,
      nClasses: colorRampOptionsRef.current?.numberOfShades,
      mode: colorRampOptionsRef.current?.selectedMode,
    };

    layer.parameters.symbologyState = symbologyState;
    layer.parameters.color = newStyle;
    if (layer.type === 'HeatmapLayer') {
      layer.type = 'VectorLayer';
    }

    model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  const buildColorInfoFromClassification = (
    selectedMode: string,
    numberOfShades: string,
    selectedRamp: string,
  ) => {
    setColorRampOptions({
      selectedRamp,
      numberOfShades,
      selectedMode,
    });

    let stops;

    const values = Array.from(selectableAttributesAndValues[selectedValue]);

    switch (selectedMode) {
      case 'quantile':
        stops = VectorClassifications.calculateQuantileBreaks(
          values,
          +numberOfShades,
        );
        break;
      case 'equal interval':
        stops = VectorClassifications.calculateEqualIntervalBreaks(
          values,
          +numberOfShades,
        );
        break;
      case 'jenks':
        stops = VectorClassifications.calculateJenksBreaks(
          values,
          +numberOfShades,
        );
        break;
      case 'pretty':
        stops = VectorClassifications.calculatePrettyBreaks(
          values,
          +numberOfShades,
        );
        break;
      case 'logarithmic':
        stops = VectorClassifications.calculateLogarithmicBreaks(
          values,
          +numberOfShades,
        );
        break;
      default:
        console.warn('No mode selected');
        return;
    }

    let stopOutputPairs = [];
    if (selectedMethod === 'radius') {
      for (let i = 0; i < +numberOfShades; i++) {
        stopOutputPairs.push({ stop: stops[i], output: stops[i] });
      }
    } else {
      stopOutputPairs = Utils.getValueColorPairs(
        stops,
        selectedRamp,
        +numberOfShades,
      );
    }

    setStopRows(stopOutputPairs);
  };

  const body = (() => {
    if (Object.keys(selectableAttributesAndValues)?.length === 0) {
      return (
        <p className="errors">
          This symbology type is not available; no attributes contain numeric
          values.
        </p>
      );
    } else {
      return (
        <>
          <ValueSelect
            featureProperties={selectableAttributesAndValues}
            selectedValue={selectedValue}
            setSelectedValue={setSelectedValue}
          />
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
            layerParams={layer.parameters}
            modeOptions={modeOptions}
            classifyFunc={buildColorInfoFromClassification}
            showModeRow={true}
          />
          <StopContainer
            selectedMethod={selectedMethod}
            stopRows={stopRows}
            setStopRows={setStopRows}
          />
        </>
      );
    }
  })();

  return (
    <div className="jp-gis-layer-symbology-container">
      <p>Color features based on an attribute containing scalar values.</p>
      {body}
    </div>
  );
};

export default Graduated;
