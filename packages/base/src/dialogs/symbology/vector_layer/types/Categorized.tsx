import { IVectorLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';

import ColorRampControls, {
  ColorRampControlsOptions,
} from '@/src/dialogs/symbology/components/color_ramp/ColorRampControls';
import StopContainer from '@/src/dialogs/symbology/components/color_stops/StopContainer';
import {
  IStopRow,
  ISymbologyTabbedDialogWithAttributesProps,
} from '@/src/dialogs/symbology/symbologyDialog';
import { Utils, VectorUtils } from '@/src/dialogs/symbology/symbologyUtils';
import ValueSelect from '@/src/dialogs/symbology/vector_layer/components/ValueSelect';
import { ColorRampName, SymbologyTab, ClassificationMode } from '@/src/types';

const Categorized: React.FC<ISymbologyTabbedDialogWithAttributesProps> = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId,
  symbologyTab,
  selectableAttributesAndValues,
}) => {
  const selectedAttributeRef = useRef<string>();
  const stopRowsRef = useRef<IStopRow[]>();
  const colorRampOptionsRef = useRef<ColorRampControlsOptions | undefined>();

  const [selectedAttribute, setSelectedAttribute] = useState('');
  const [stopRows, setStopRows] = useState<IStopRow[]>([]);
  const [colorRampOptions, setColorRampOptions] = useState<
    ColorRampControlsOptions | undefined
  >();
  const [manualStyle, setManualStyle] = useState({
    fillColor: '#3399CC',
    strokeColor: '#3399CC',
    strokeWidth: 1.25,
    radius: 5,
  });
  const manualStyleRef = useRef(manualStyle);
  const [dataMin, setDataMin] = useState<number | undefined>();
  const [dataMax, setDataMax] = useState<number | undefined>();

  if (!layerId) {
    return null;
  }
  const layer = model.getLayer(layerId);
  if (!layer?.parameters) {
    return null;
  }

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
      const fillColor = layer.parameters.color['fill-color'];
      const circleFillColor = layer.parameters.color['circle-fill-color'];
      const strokeColor = layer.parameters.color['stroke-color'];
      const circleStrokeColor = layer.parameters.color['circle-stroke-color'];

      const isSimpleColor = (val: any) =>
        typeof val === 'string' && /^#?[0-9A-Fa-f]{3,8}$/.test(val);

      setManualStyle({
        fillColor: isSimpleColor(fillColor)
          ? fillColor
          : isSimpleColor(circleFillColor)
            ? circleFillColor
            : '#3399CC',

        strokeColor: isSimpleColor(strokeColor)
          ? strokeColor
          : isSimpleColor(circleStrokeColor)
            ? circleStrokeColor
            : '#3399CC',

        strokeWidth:
          layer.parameters.color['stroke-width'] ||
          layer.parameters.color['circle-stroke-width'] ||
          1.25,
        radius: layer.parameters.color['circle-radius'] || 5,
      });
    }
  }, [layerId]);

  useEffect(() => {
    manualStyleRef.current = manualStyle;
  }, [manualStyle]);

  useEffect(() => {
    // We only want number values here
    const layerParams = layer.parameters as IVectorLayer;
    const attribute =
      layerParams.symbologyState?.value ??
      Object.keys(selectableAttributesAndValues)[0];

    setSelectedAttribute(attribute);

    const values = Array.from(selectableAttributesAndValues[attribute] ?? []);
    if (values.length > 0) {
      const min = Math.min(...values);
      const max = Math.max(...values);

      setDataMin(min);
      setDataMax(max);
    }
  }, [selectableAttributesAndValues]);

  useEffect(() => {
    selectedAttributeRef.current = selectedAttribute;
    stopRowsRef.current = stopRows;
    colorRampOptionsRef.current = colorRampOptions;
  }, [selectedAttribute, stopRows, colorRampOptions]);

  const buildColorInfoFromClassification = (
    selectedMode: ClassificationMode,
    numberOfShades: number,
    selectedRamp: ColorRampName,
    reverseRamp: boolean,
    setIsLoading: (isLoading: boolean) => void,
    minValue: number,
    maxValue: number,
  ) => {
    setColorRampOptions({
      selectedRamp,
      reverseRamp,
      numberOfShades,
      selectedMode,
      minValue,
      maxValue,
    });

    const stops = Array.from(
      selectableAttributesAndValues[selectedAttribute],
    ).sort((a, b) => a - b);

    const valueColorPairs = Utils.getValueColorPairs(
      stops,
      selectedRamp,
      stops.length,
      reverseRamp,
      'Categorized',
      minValue,
      maxValue,
    );

    setStopRows(valueColorPairs);
  };

  const handleOk = () => {
    if (!layer.parameters) {
      return;
    }

    const newStyle = { ...layer.parameters.color };

    if (stopRowsRef.current && stopRowsRef.current.length > 0) {
      // Classification applied (for color)
      const expr: ExpressionValue[] = ['case'];

      stopRowsRef.current.forEach(stop => {
        expr.push(['==', ['get', selectedAttributeRef.current], stop.stop]);
        expr.push(stop.output);
      });

      if (symbologyTab === 'color') {
        expr.push([0, 0, 0, 0.0]); // fallback color

        newStyle['fill-color'] = expr;
        newStyle['circle-fill-color'] = expr;
        newStyle['stroke-color'] = expr;
        newStyle['circle-stroke-color'] = expr;
      }
    } else {
      newStyle['fill-color'] = manualStyleRef.current.fillColor;
      newStyle['circle-fill-color'] = manualStyleRef.current.fillColor;
    }

    newStyle['stroke-width'] = manualStyleRef.current.strokeWidth;
    newStyle['circle-stroke-width'] = manualStyleRef.current.strokeWidth;
    newStyle['circle-radius'] = manualStyleRef.current.radius;
    newStyle['circle-stroke-color'] = manualStyleRef.current.strokeColor;

    const symbologyState = {
      renderType: 'Categorized',
      value: selectedAttributeRef.current,
      colorRamp: colorRampOptionsRef.current?.selectedRamp,
      reverse: colorRampOptionsRef.current?.reverseRamp,
      symbologyTab,
    };

    layer.parameters.symbologyState = symbologyState;
    layer.parameters.color = newStyle;

    if (layer.type === 'HeatmapLayer') {
      layer.type = 'VectorLayer';
    }

    model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  const handleReset = (method: SymbologyTab) => {
    if (!layer?.parameters) {
      return;
    }

    const newStyle = { ...layer.parameters.color };

    if (method === 'color') {
      delete newStyle['fill-color'];
      delete newStyle['stroke-color'];
      delete newStyle['circle-fill-color'];
      delete newStyle['circle-stroke-color'];
      setStopRows([]);

      // Reset color classification options
      if (layer.parameters.symbologyState) {
        layer.parameters.symbologyState.colorRamp = undefined;
      }
    }

    if (method === 'radius') {
      delete newStyle['circle-radius'];
    }

    layer.parameters.color = newStyle;

    model.sharedModel.updateLayer(layerId, layer);
  };

  const body = (() => {
    if (Object.keys(selectableAttributesAndValues).length === 0) {
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
            selectedValue={selectedAttribute}
            setSelectedValue={setSelectedAttribute}
          />

          <div className="jp-gis-layer-symbology-container">
            {/* Inputs depending on active tab */}
            {symbologyTab === 'color' && (
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
                        fillColor: e.target.value,
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
                      setManualStyle(prev => ({
                        ...prev,
                        strokeColor: e.target.value,
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
                      setManualStyle(prev => ({
                        ...prev,
                        strokeWidth: +e.target.value,
                      }));
                    }}
                  />
                </div>
              </>
            )}

            {symbologyTab === 'radius' && (
              <div className="jp-gis-symbology-row">
                <label>Circle Radius:</label>
                <input
                  type="number"
                  className="jp-mod-styled"
                  value={manualStyle.radius}
                  onChange={e => {
                    setManualStyle(prev => ({
                      ...prev,
                      radius: +e.target.value,
                    }));
                  }}
                />
              </div>
            )}
          </div>

          <div className="jp-gis-layer-symbology-container">
            <ColorRampControls
              layerParams={layer.parameters}
              modeOptions={[]}
              classifyFunc={buildColorInfoFromClassification}
              showModeRow={false}
              showRampSelector={symbologyTab === 'color'}
              renderType="Categorized"
              dataMin={dataMin}
              dataMax={dataMax}
            />
            <StopContainer
              selectedMethod={''}
              stopRows={stopRows}
              setStopRows={setStopRows}
            />
          </div>
        </>
      );
    }
  })();

  return (
    <div className="jp-gis-layer-symbology-container">
      <p>Color features based on an attribute containing unique values.</p>
      {body}
    </div>
  );
};

export default Categorized;
