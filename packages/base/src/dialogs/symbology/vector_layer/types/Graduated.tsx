import { IVectorLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';
import { getNumericFeatureAttributes } from '../../../../tools';
import { VectorClassifications } from '../../classificationModes';
import ColorRamp, {
  ColorRampOptions
} from '../../components/color_ramp/ColorRamp';
import StopContainer from '../../components/color_stops/StopContainer';
import { useGetProperties } from '../../hooks/useGetProperties';
import { IStopRow, ISymbologyDialogProps } from '../../symbologyDialog';
import { Utils, VectorUtils } from '../../symbologyUtils';
import ValueSelect from '../components/ValueSelect';

interface IGraduatedProps extends ISymbologyDialogProps {
  selectedMethod: 'color' | 'radius';
  setSelectedMethod: (tab: 'color' | 'radius') => void;
}

const Graduated: React.FC<IGraduatedProps> = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId,
  selectedMethod,
  setSelectedMethod
}) => {
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
  const [stopRows, setStopRows] = useState<IStopRow[]>([]);
  const [features, setFeatures] = useState<Record<string, Set<number>>>({});
  const [colorRampOptions, setColorRampOptions] = useState<
    ColorRampOptions | undefined
  >();
  const [manualStyle, setManualStyle] = useState({
    fillColor: '#3399CC',
    strokeColor: '#3399CC',
    strokeWidth: 1.25,
    radius: 5
  });
  const manualStyleRef = useRef(manualStyle);

  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  const { featureProperties } = useGetProperties({
    layerId,
    model: model
  });

  useEffect(() => {
    let stopOutputPairs: IStopRow[] = [];

    if (selectedMethod === 'color') {
      stopOutputPairs = VectorUtils.buildColorInfo(layer);
    }

    if (selectedMethod === 'radius') {
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
    if (layer?.parameters?.color) {
      setManualStyle({
        fillColor:
          layer.parameters.color['fill-color'] ||
          layer.parameters.color['circle-fill-color'] ||
          '#3399CC',
        strokeColor:
          layer.parameters.color['stroke-color'] ||
          layer.parameters.color['circle-stroke-color'] ||
          '#3399CC',
        strokeWidth:
          layer.parameters.color['stroke-width'] ||
          layer.parameters.color['circle-stroke-width'] ||
          1.25,
        radius: layer.parameters.color['circle-radius'] || 5
      });
    }
  }, [layerId]);

  useEffect(() => {
    manualStyleRef.current = manualStyle;
  }, [manualStyle]);

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
    // We only want number values here
    const numericFeatures = getNumericFeatureAttributes(featureProperties);

    setFeatures(numericFeatures);

    const layerParams = layer.parameters as IVectorLayer;
    const value =
      layerParams.symbologyState?.value ?? Object.keys(numericFeatures)[0];

    setSelectedValue(value);
    setSelectedMethod(selectedMethod);
  }, [featureProperties]);

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

    const newStyle = { ...layer.parameters.color };

    if (stopRowsRef.current && stopRowsRef.current.length > 0) {
      // If classification applied
      const colorExpr: ExpressionValue[] = [];
      colorExpr.push('interpolate');
      colorExpr.push(['linear']);
      colorExpr.push(['get', selectedValueRef.current]);

      stopRowsRef.current.map(stop => {
        colorExpr.push(stop.stop);
        colorExpr.push(stop.output);
      });

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
        mode: colorRampOptionsRef.current?.selectedMode
      };

      layer.parameters.symbologyState = symbologyState;
    } else {
      // No classification applied
      if (selectedMethodRef.current === 'color') {
        newStyle['fill-color'] = manualStyleRef.current.fillColor;
        newStyle['stroke-color'] = manualStyleRef.current.strokeColor;
        newStyle['circle-stroke-color'] = manualStyleRef.current.strokeColor;
        newStyle['circle-fill-color'] = manualStyleRef.current.fillColor;
        newStyle['stroke-width'] = manualStyleRef.current.strokeWidth;
        newStyle['circle-stroke-width'] = manualStyleRef.current.strokeWidth;
      }

      if (selectedMethodRef.current === 'radius') {
        newStyle['circle-radius'] = manualStyleRef.current.radius;
      }

      const symbologyState = {
        renderType: 'Graduated',
        value: selectedValueRef.current,
        method: selectedMethodRef.current,
        colorRamp: undefined,
        nClasses: undefined,
        mode: undefined
      };

      layer.parameters.symbologyState = symbologyState;
    }

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
    selectedRamp: string
  ) => {
    setColorRampOptions({
      selectedRamp,
      numberOfShades,
      selectedMode
    });

    let stops;

    const values = Array.from(features[selectedValue]);

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

    let stopOutputPairs = [];
    if (selectedMethod === 'radius') {
      for (let i = 0; i < +numberOfShades; i++) {
        stopOutputPairs.push({ stop: stops[i], output: stops[i] });
      }
    } else {
      stopOutputPairs = Utils.getValueColorPairs(
        stops,
        selectedRamp,
        +numberOfShades
      );
    }

    setStopRows(stopOutputPairs);
  };

  const handleReset = (method: string) => {
    if (!layer?.parameters) {
      return;
    }

    const newStyle = { ...layer.parameters.color };

    if (method === 'color') {
      delete newStyle['fill-color'];
      delete newStyle['stroke-color'];
      delete newStyle['circle-fill-color'];

      // Only reset color classification
      if (layer.parameters.symbologyState) {
        layer.parameters.symbologyState.colorRamp = undefined;
        layer.parameters.symbologyState.nClasses = undefined;
        layer.parameters.symbologyState.mode = undefined;
      }
    }

    if (method === 'radius') {
      delete newStyle['circle-radius'];
    }

    layer.parameters.color = newStyle;

    setStopRows(prev => {
      if (selectedMethod === method) {
        return [];
      }
      return prev;
    });

    if (method === 'color') {
      setColorRampOptions(undefined);
    }

    model.sharedModel.updateLayer(layerId, layer);
  };

  return (
    <div className="jp-gis-layer-symbology-container">
      <ValueSelect
        featureProperties={features}
        selectedValue={selectedValue}
        setSelectedValue={setSelectedValue}
      />
      <div className="jp-gis-layer-symbology-container">
        {selectedMethod === 'color' && (
          <>
            <div className="jp-gis-symbology-row">
              <label>Fill Color:</label>
              <input
                type="color"
                className="jp-mod-styled"
                value={manualStyle.fillColor}
                onChange={e => {
                  handleReset('color');
                  setManualStyle({ ...manualStyle, fillColor: e.target.value });
                }}
              />
            </div>
            <div className="jp-gis-symbology-row">
              <label>Stroke Color:</label>
              <input
                type="color"
                className="jp-mod-styled"
                value={manualStyle.strokeColor}
                onChange={e => {
                  handleReset('color');
                  setManualStyle({
                    ...manualStyle,
                    strokeColor: e.target.value
                  });
                }}
              />
            </div>
            <div className="jp-gis-symbology-row">
              <label>Stroke Width:</label>
              <input
                type="number"
                className="jp-mod-styled"
                value={manualStyle.strokeWidth}
                onChange={e => {
                  handleReset('color');
                  setManualStyle({
                    ...manualStyle,
                    strokeWidth: +e.target.value
                  });
                }}
              />
            </div>
          </>
        )}

        {selectedMethod === 'radius' && (
          <div className="jp-gis-symbology-row">
            <label>Circle Radius:</label>
            <input
              type="number"
              className="jp-mod-styled"
              value={manualStyle.radius}
              onChange={e => {
                handleReset('radius');
                setManualStyle({ ...manualStyle, radius: +e.target.value });
              }}
            />
          </div>
        )}
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
