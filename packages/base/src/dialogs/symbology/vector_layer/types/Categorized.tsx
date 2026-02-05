import { IVectorLayer } from '@jupytergis/schema';
import { ReadonlyJSONObject } from '@lumino/coreutils';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useState } from 'react';

import ColorRampControls from '@/src/dialogs/symbology/components/color_ramp/ColorRampControls';
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
  state,
  okSignalPromise,
  resolveDialog,
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
  const [manualStyle, setManualStyle] = useState({
    fillColor: '#3399CC',
    strokeColor: '#3399CC',
    strokeWidth: 1.25,
    radius: 5,
  });
  const manualStyleRef = useLatest(manualStyle);
  const [reverseRamp, setReverseRamp] = useState(false);
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
          params.color['stroke-width'] ||
          params.color['circle-stroke-width'] ||
          1.25,
        radius: params.color['circle-radius'] || 5,
      });
    }
  }, [layerId]);

  useEffect(() => {
    // We only want number values here
    const attribute =
      params.symbologyState?.value ??
      Object.keys(selectableAttributesAndValues)[0];

    setSelectedAttribute(attribute);
  }, [selectableAttributesAndValues]);

  const buildColorInfoFromClassification = (
    selectedMode: ClassificationMode,
    numberOfShades: number,
    selectedRamp: ColorRampName,
    setIsLoading: (isLoading: boolean) => void,
  ) => {
    setColorRampOptions({
      selectedFunction: '',
      selectedRamp,
      numberOfShades,
      selectedMode,
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

    newStyle['stroke-width'] = manualStyleRef.current.strokeWidth;
    newStyle['circle-stroke-width'] = manualStyleRef.current.strokeWidth;
    newStyle['circle-radius'] = manualStyleRef.current.radius;
    newStyle['circle-stroke-color'] = manualStyleRef.current.strokeColor;

    const symbologyState = {
      renderType: 'Categorized',
      value: selectedAttributeRef.current,
      colorRamp: colorRampOptionsRef.current?.selectedRamp,
      symbologyTab,
      reverse: reverseRamp,
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

          {symbologyTab === 'color' && (
            <div className="jp-gis-symbology-row">
              <label>
                <input
                  type="checkbox"
                  checked={reverseRamp}
                  onChange={e => setReverseRamp(e.target.checked)}
                />
                Reverse Color Ramp
              </label>
            </div>
          )}

          <div className="jp-gis-layer-symbology-container">
            //! only needs symbology state
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
