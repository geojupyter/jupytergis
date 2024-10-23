import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';
import { VectorClassifications } from '../../classificationModes';
import { IStopRow, ISymbologyDialogProps } from '../../symbologyDialog';
import ColorRamp, {
  ColorRampOptions
} from '../../components/color_ramp/ColorRamp';
import ValueSelect from '../components/ValueSelect';
import StopContainer from '../../components/color_stops/StopContainer';
import { useGetProperties } from '../../hooks/useGetProperties';
import { Utils, VectorUtils } from '../../symbologyUtils';
import { IVectorLayer } from '@jupytergis/schema';

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
  const layer = context.model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  const { featureProps } = useGetProperties({
    layerId,
    model: context.model
  });

  useEffect(() => {
    const valueColorPairs = VectorUtils.buildColorInfo(layer);

    setStopRows(valueColorPairs);

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
    colorRampOptionsRef.current = colorRampOptions;
  }, [selectedValue, selectedMethod, stopRows, colorRampOptions]);

  useEffect(() => {
    populateOptions();
  }, [featureProps]);

  const populateOptions = async () => {
    // Set up method options
    if (layer?.parameters?.type === 'circle') {
      const options = ['color', 'radius'];
      setMethodOptions(options);
    }

    const layerParams = layer.parameters as IVectorLayer;
    const value =
      layerParams.symbologyState?.value ?? Object.keys(featureProps)[0];
    const method = layerParams.symbologyState?.method ?? 'color';

    setSelectedValue(value);
    setSelectedMethod(method);
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

    const symbologyState = {
      renderType: 'Graduated',
      value: selectedValueRef.current,
      method: selectedMethodRef.current,
      colorRamp: colorRampOptionsRef.current?.selectedRamp,
      nClasses: colorRampOptionsRef.current?.numberOfShades,
      mode: colorRampOptionsRef.current?.selectedMode
    };

    layer.parameters.symbologyState = symbologyState;
    layer.parameters.color = newStyle;

    context.model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  const buildColorInfoFromClassification = (
    selectedMode: string,
    numberOfShades: string,
    selectedRamp: string
  ) => {
    setColorRampOptions({
      selectedRamp,
      numberOfShades,
      selectedMode
    });

    let stops;

    const values = Array.from(featureProps[selectedValue]);

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

    const valueColorPairs = Utils.getValueColorPairs(
      stops,
      selectedRamp,
      +numberOfShades
    );

    setStopRows(valueColorPairs);
  };

  return (
    <div className="jp-gis-layer-symbology-container">
      <ValueSelect
        featureProperties={featureProps}
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
    </div>
  );
};

export default Graduated;
