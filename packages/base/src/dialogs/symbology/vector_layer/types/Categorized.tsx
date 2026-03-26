import { IVectorLayer } from '@jupytergis/schema';
import { ReadonlyJSONObject } from '@lumino/coreutils';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useState } from 'react';

import ColorRampControls from '@/src/dialogs/symbology/components/color_ramp/ColorRampControls';
import RgbaColorPicker from '@/src/dialogs/symbology/components/color_ramp/RgbaColorPicker';
import {
  colorToRgba,
  DEFAULT_COLOR,
  isColor,
  RgbaColor,
} from '@/src/dialogs/symbology/colorRampUtils';
import StopContainer from '@/src/dialogs/symbology/components/color_stops/StopContainer';
import { useOkSignal } from '@/src/dialogs/symbology/hooks/useOkSignal';
import {
  IStopRow,
  ISymbologyTabbedDialogWithAttributesProps,
} from '@/src/dialogs/symbology/symbologyDialog';
import {
  Utils,
  VectorSymbologyParams,
  VectorUtils,
  saveSymbology,
} from '@/src/dialogs/symbology/symbologyUtils';
import ValueSelect from '@/src/dialogs/symbology/vector_layer/components/ValueSelect';
import { useLatest } from '@/src/shared/hooks/useLatest';
import { SymbologyTab, ClassificationMode } from '@/src/types';
import { ColorRampName } from '../../colorRampUtils';
import { useEffectiveSymbologyParams } from '../../hooks/useEffectiveSymbologyParams';

const Categorized: React.FC<ISymbologyTabbedDialogWithAttributesProps> = ({
  model,
  okSignalPromise,
  layerId,
  symbologyTab,
  selectableAttributesAndValues,
  isStorySegmentOverride,
  segmentId,
}) => {
  const [selectedAttribute, setSelectedAttribute] = useState('');
  const [stopRows, setStopRows] = useState<IStopRow[]>([]);
  const [colorRampOptions, setColorRampOptions] = useState<
    ReadonlyJSONObject | undefined
  >();
  const [manualStyle, setManualStyle] = useState<{
    fillColor: RgbaColor;
    strokeColor: RgbaColor;
    strokeWidth: string;
    radius: number;
  }>({
    fillColor: DEFAULT_COLOR,
    strokeColor: DEFAULT_COLOR,
    strokeWidth: '1.25',
    radius: 5,
  });
  const manualStyleRef = useLatest(manualStyle);
  const selectedAttributeRef = useLatest(selectedAttribute);
  const stopRowsRef = useLatest(stopRows);
  const colorRampOptionsRef = useLatest(colorRampOptions);

  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);

  const params = useEffectiveSymbologyParams<VectorSymbologyParams>({
    model,
    layerId: layerId,
    layer,
    isStorySegmentOverride,
    segmentId,
  });

  if (!params) {
    return;
  }

  useEffect(() => {
    const valueColorPairs = VectorUtils.buildColorInfo(params);

    setStopRows(valueColorPairs);
  }, []);

  useEffect(() => {
    if (params.color) {
      const fillColor = params.color['fill-color'];
      const circleFillColor = params.color['circle-fill-color'];
      const strokeColor = params.color['stroke-color'];
      const circleStrokeColor = params.color['circle-stroke-color'];

      const effectiveFill = isColor(fillColor)
        ? fillColor
        : isColor(circleFillColor)
          ? circleFillColor
          : DEFAULT_COLOR;

      const effectiveStroke = isColor(strokeColor)
        ? strokeColor
        : isColor(circleStrokeColor)
          ? circleStrokeColor
          : DEFAULT_COLOR;

      setManualStyle({
        fillColor: colorToRgba(effectiveFill),
        strokeColor: colorToRgba(effectiveStroke),
        strokeWidth: String(
          params.color['stroke-width'] ||
            params.color['circle-stroke-width'] ||
            1.25,
        ),
        radius: params.color['circle-radius'] || 5,
      });
    }
  }, [layerId]);

  useEffect(() => {
    // We only want number values here
    const attribute =
      params.symbologyState?.value ||
      Object.keys(selectableAttributesAndValues)[0];

    setSelectedAttribute(attribute);
  }, [selectableAttributesAndValues]);

  const buildColorInfoFromClassification = (
    selectedMode: ClassificationMode,
    numberOfShades: number,
    selectedRamp: ColorRampName,
    reverseRamp: boolean,
    setIsLoading: (isLoading: boolean) => void,
  ) => {
    setColorRampOptions({
      selectedFunction: '',
      selectedRamp,
      numberOfShades,
      selectedMode,
      reverseRamp,
    });

    const stops = Array.from(
      selectableAttributesAndValues[selectedAttribute],
    ).sort((a, b) => a - b);

    const valueColorPairs = Utils.getValueColorPairs(
      stops,
      selectedRamp,
      stops.length,
      reverseRamp,
    );

    setStopRows(valueColorPairs);
  };

  const handleOk = () => {
    const newStyle = { ...params.color };

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

    newStyle['stroke-width'] = Math.max(
      0,
      parseFloat(manualStyleRef.current.strokeWidth),
    );
    newStyle['circle-stroke-width'] = Math.max(
      0,
      parseFloat(manualStyleRef.current.strokeWidth),
    );
    newStyle['circle-radius'] = manualStyleRef.current.radius;
    newStyle['circle-stroke-color'] = manualStyleRef.current.strokeColor;

    const symbologyState = {
      renderType: 'Categorized',
      value: selectedAttributeRef.current,
      colorRamp: colorRampOptionsRef.current?.selectedRamp,
      method: symbologyTab,
      reverseRamp: colorRampOptionsRef.current?.reverseRamp,
    } as IVectorLayer['symbologyState'];

    saveSymbology({
      model,
      layerId,
      isStorySegmentOverride,
      segmentId,
      payload: {
        symbologyState,
        color: newStyle,
      },
      mutateLayerBeforeSave: targetLayer => {
        if (targetLayer.type === 'HeatmapLayer') {
          targetLayer.type = 'VectorLayer';
        }
      },
    });
  };

  useOkSignal(okSignalPromise, handleOk);

  const handleReset = (method: SymbologyTab) => {
    if (!layer?.parameters) {
      return;
    }

    const newStyle = { ...params.color };

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
                  <RgbaColorPicker
                    color={manualStyle.fillColor}
                    onChange={color => {
                      handleReset('color');
                      setManualStyle(prev => ({ ...prev, fillColor: color }));
                    }}
                  />
                </div>
                <div className="jp-gis-symbology-row">
                  <label>Stroke Color:</label>
                  <RgbaColorPicker
                    color={manualStyle.strokeColor}
                    onChange={color =>
                      setManualStyle(prev => ({ ...prev, strokeColor: color }))
                    }
                  />
                </div>
                <div className="jp-gis-symbology-row">
                  <label>Stroke Width:</label>
                  <input
                    type="text"
                    className="jp-mod-styled"
                    value={manualStyle.strokeWidth}
                    onChange={e => {
                      setManualStyle(prev => ({
                        ...prev,
                        strokeWidth: e.target.value,
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
              layerParams={params}
              modeOptions={[]}
              classifyFunc={buildColorInfoFromClassification}
              showModeRow={false}
              showRampSelector={symbologyTab === 'color'}
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
