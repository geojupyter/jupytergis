import { IVectorLayer } from '@jupytergis/schema';
import { ReadonlyJSONObject } from '@lumino/coreutils';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';
import { getNumericFeatureAttributes } from '../../../../tools';
import ColorRamp from '../../components/color_ramp/ColorRamp';
import StopContainer from '../../components/color_stops/StopContainer';
import { useGetProperties } from '../../hooks/useGetProperties';
import { IStopRow, ISymbologyDialogProps } from '../../symbologyDialog';
import { Utils, VectorUtils } from '../../symbologyUtils';
import ValueSelect from '../components/ValueSelect';
import { activeTab } from '../../../../types';

const Categorized = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId,
  activeTab
}: ISymbologyDialogProps) => {
  const selectedValueRef = useRef<string>();
  const stopRowsRef = useRef<IStopRow[]>();
  const colorRampOptionsRef = useRef<ReadonlyJSONObject | undefined>();

  const [selectedValue, setSelectedValue] = useState('');
  const [stopRows, setStopRows] = useState<IStopRow[]>([]);
  const [colorRampOptions, setColorRampOptions] = useState<
    ReadonlyJSONObject | undefined
  >();
  const [features, setFeatures] = useState<Record<string, Set<number>>>({});
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
    // We only want number values here
    const numericFeatures = getNumericFeatureAttributes(featureProperties);

    setFeatures(numericFeatures);

    const layerParams = layer.parameters as IVectorLayer;
    const value =
      layerParams.symbologyState?.value ?? Object.keys(numericFeatures)[0];

    setSelectedValue(value);
  }, [featureProperties]);

  useEffect(() => {
    selectedValueRef.current = selectedValue;
    stopRowsRef.current = stopRows;
    colorRampOptionsRef.current = colorRampOptions;
  }, [selectedValue, stopRows, colorRampOptions]);

  const buildColorInfoFromClassification = (
    selectedMode: string,
    numberOfShades: string,
    selectedRamp: string,
    setIsLoading: (isLoading: boolean) => void
  ) => {
    setColorRampOptions({
      selectedFunction: '',
      selectedRamp,
      numberOfShades: '',
      selectedMode: ''
    });

    const stops = Array.from(features[selectedValue]).sort((a, b) => a - b);

    const valueColorPairs = Utils.getValueColorPairs(
      stops,
      selectedRamp,
      stops.length
    );

    setStopRows(valueColorPairs);
  };

  const handleOk = () => {
    if (!layer.parameters) {
      return;
    }

    const newStyle = { ...layer.parameters.color };

    if (stopRowsRef.current && stopRowsRef.current.length > 0) {
      // If classification applied
      const expr: ExpressionValue[] = ['case'];

      stopRowsRef.current.forEach(stop => {
        expr.push(['==', ['get', selectedValueRef.current], stop.stop]);
        expr.push(stop.output);
      });

      if (activeTab === 'color') {
        expr.push([0, 0, 0, 0.0]); // fallback color

        newStyle['fill-color'] = expr;
        newStyle['circle-fill-color'] = expr;
        newStyle['stroke-color'] = expr;
        newStyle['circle-stroke-color'] = expr;
      }

      const symbologyState = {
        renderType: 'Categorized',
        value: selectedValueRef.current,
        colorRamp: colorRampOptionsRef.current?.selectedRamp,
        nClasses: colorRampOptionsRef.current?.numberOfShades,
        mode: colorRampOptionsRef.current?.selectedMode,
        activeTab
      };

      layer.parameters.symbologyState = symbologyState;
    } else {
      newStyle['fill-color'] = manualStyleRef.current.fillColor;
      newStyle['stroke-color'] = manualStyleRef.current.strokeColor;
      newStyle['circle-fill-color'] = manualStyleRef.current.fillColor;
      newStyle['circle-stroke-color'] = manualStyleRef.current.strokeColor;
      newStyle['stroke-width'] = manualStyleRef.current.strokeWidth;
      newStyle['circle-stroke-width'] = manualStyleRef.current.strokeWidth;
      newStyle['circle-radius'] = manualStyleRef.current.radius;

      const symbologyState = {
        renderType: 'Categorized',
        value: selectedValueRef.current,
        colorRamp: undefined,
        nClasses: undefined,
        mode: undefined,
        activeTab
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

  const handleReset = (method: activeTab) => {
    if (!layer?.parameters) {
      return;
    }

    const newStyle = { ...layer.parameters.color };

    if (method === 'color') {
      delete newStyle['fill-color'];
      delete newStyle['stroke-color'];
      delete newStyle['circle-fill-color'];
      delete newStyle['circle-stroke-color'];

      // Reset color classification options
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

    setStopRows(prev => (activeTab === method ? [] : prev));
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
        {/* Inputs depending on active tab */}
        {activeTab === 'color' && (
          <>
            <div className="jp-gis-symbology-row">
              <label>Fill Color:</label>
              <input
                type="color"
                className="jp-mod-styled"
                value={manualStyle.fillColor}
                onChange={e => {
                  handleReset('color');
                  setManualStyle(prev => ({
                    ...prev,
                    fillColor: e.target.value
                  }));
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
                  setManualStyle(prev => ({
                    ...prev,
                    strokeColor: e.target.value
                  }));
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
                  setManualStyle(prev => ({
                    ...prev,
                    strokeWidth: +e.target.value
                  }));
                }}
              />
            </div>
          </>
        )}

        {activeTab === 'radius' && (
          <div className="jp-gis-symbology-row">
            <label>Circle Radius:</label>
            <input
              type="number"
              className="jp-mod-styled"
              value={manualStyle.radius}
              onChange={e => {
                handleReset('radius');
                setManualStyle(prev => ({
                  ...prev,
                  radius: +e.target.value
                }));
              }}
            />
          </div>
        )}
      </div>

      <div className="jp-gis-layer-symbology-container">
        <ColorRamp
          layerParams={layer.parameters}
          modeOptions={[]}
          classifyFunc={buildColorInfoFromClassification}
          showModeRow={false}
        />
        <StopContainer
          selectedMethod={''}
          stopRows={stopRows}
          setStopRows={setStopRows}
        />
      </div>
    </div>
  );
};

export default Categorized;
