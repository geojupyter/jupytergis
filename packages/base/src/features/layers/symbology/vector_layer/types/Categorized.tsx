import { IVectorLayer } from '@jupytergis/schema';
import { ReadonlyJSONObject, UUID } from '@lumino/coreutils';
import React, { useEffect, useRef, useState } from 'react';

import {
  colorToRgba,
  DEFAULT_COLOR,
  DEFAULT_STROKE_WIDTH,
  getColorMap,
  getColorMapList,
  RgbaColor,
} from '@/src/features/layers/symbology/colorRampUtils';
import ColorRampControls from '@/src/features/layers/symbology/components/color_ramp/ColorRampControls';
import RgbaColorPicker from '@/src/features/layers/symbology/components/color_ramp/RgbaColorPicker';
import StopContainer from '@/src/features/layers/symbology/components/color_stops/StopContainer';
import { useOkSignal } from '@/src/features/layers/symbology/hooks/useOkSignal';
import {
  IStopRow,
  ISymbologyTabbedDialogWithAttributesProps,
} from '@/src/features/layers/symbology/symbologyDialog';
import {
  Utils,
  VectorSymbologyParams,
  saveSymbology,
} from '@/src/features/layers/symbology/symbologyUtils';
import ValueSelect from '@/src/features/layers/symbology/vector_layer/components/ValueSelect';
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
  const [fallbackColor, setFallbackColor] = useState<RgbaColor>([0, 0, 0, 0]);
  const [strokeFollowsFill, setStrokeFollowsFill] = useState(false);
  const fallbackColorRef = useLatest(fallbackColor);
  const strokeFollowsFillRef = useLatest(strokeFollowsFill);
  const [manualStyle, setManualStyle] = useState<{
    fillColor: RgbaColor;
    strokeColor: RgbaColor;
    strokeWidth: string;
    radius: number;
  }>({
    fillColor: DEFAULT_COLOR,
    strokeColor: DEFAULT_COLOR,
    strokeWidth: String(DEFAULT_STROKE_WIDTH),
    radius: 5,
  });
  const manualStyleRef = useLatest(manualStyle);
  const selectedAttributeRef = useLatest(selectedAttribute);
  const stopRowsRef = useLatest(stopRows);
  const colorRampOptionsRef = useLatest(colorRampOptions);

  // Tracks whether the user manually edited stop colors.
  const hasColorOverrides = useRef(false);

  const handleManualStopEdit = (rows: IStopRow[]) => {
    hasColorOverrides.current = true;
    setStopRows(rows);
  };

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

  // Auto-classify on first load once selectedAttribute is ready.
  const hasAutoClassified = useRef(false);

  useEffect(() => {
    const state = params.symbologyState;
    if (state) {
      setManualStyle({
        fillColor: colorToRgba(state.fillColor ?? DEFAULT_COLOR),
        strokeColor: colorToRgba(state.strokeColor ?? DEFAULT_COLOR),
        strokeWidth: String(state.strokeWidth ?? DEFAULT_STROKE_WIDTH),
        radius: state.radius ?? 5,
      });
    }

    setFallbackColor(
      colorToRgba(params.symbologyState?.fallbackColor ?? [0, 0, 0, 0]),
    );
    setStrokeFollowsFill(params.symbologyState?.strokeFollowsFill ?? false);
  }, [layerId]);

  useEffect(() => {
    const savedValue = params.symbologyState?.value;
    const attribute =
      savedValue && savedValue in selectableAttributesAndValues
        ? savedValue
        : Object.keys(selectableAttributesAndValues)[0];

    setSelectedAttribute(attribute);
  }, [selectableAttributesAndValues]);

  // Auto-classify once selectedAttribute is available, or restore overrides.
  useEffect(() => {
    if (hasAutoClassified.current) {
      return;
    }
    if (
      !selectedAttribute ||
      !selectableAttributesAndValues[selectedAttribute]
    ) {
      return;
    }
    const state = params.symbologyState;
    if (state?.renderType === 'Categorized') {
      hasAutoClassified.current = true;

      // If user previously saved manual overrides, restore them.
      if (state.colorStopsOverride && state.colorStopsOverride.length > 0) {
        setStopRows(
          state.colorStopsOverride
            .filter(s => s.value !== undefined && s.color !== undefined)
            .map(s => ({
              id: UUID.uuid4(),
              stop: s.value as number | string,
              output: s.color as [number, number, number, number],
            })),
        );
        hasColorOverrides.current = true;
        return;
      }

      const rampName = (state.colorRamp ?? 'viridis') as ColorRampName;
      const reverse = state.reverseRamp ?? false;
      const stops = Array.from(
        selectableAttributesAndValues[selectedAttribute],
      ).sort((a, b) => a - b);
      const colorRamp = getColorMapList().find(c => c.name === rampName);
      if (colorRamp && stops.length > 0) {
        setStopRows(
          Utils.getValueColorPairs(stops, colorRamp, stops.length, reverse),
        );
      }
    }
  }, [selectedAttribute]);

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

    if (!selectableAttributesAndValues[selectedAttribute]) {
      return;
    }
    const stops = Array.from(
      selectableAttributesAndValues[selectedAttribute],
    ).sort((a, b) => a - b);

    const colorRamp = getColorMap(selectedRamp);
    if (!colorRamp) {
      return;
    }

    const valueColorPairs = Utils.getValueColorPairs(
      stops,
      colorRamp,
      stops.length,
      reverseRamp,
    );

    setStopRows(valueColorPairs);
    hasColorOverrides.current = false;
  };

  const handleOk = () => {
    const strokeWidth = Math.max(
      0,
      parseFloat(manualStyleRef.current.strokeWidth),
    );

    const method =
      symbologyTab === 'radius' ? ('radius' as const) : ('color' as const);

    // Save manual color overrides if user edited stops.
    const colorStopsOverride = hasColorOverrides.current
      ? (stopRowsRef.current ?? []).map(row => ({
          value: row.stop,
          color: row.output as [number, number, number, number],
        }))
      : undefined;

    const symbologyState: IVectorLayer['symbologyState'] = {
      renderType: 'Categorized',
      value: selectedAttributeRef.current,
      colorRamp: colorRampOptionsRef.current?.selectedRamp as
        | string
        | undefined,
      method,
      reverseRamp: colorRampOptionsRef.current?.reverseRamp as
        | boolean
        | undefined,
      fallbackColor: fallbackColorRef.current,
      strokeFollowsFill: strokeFollowsFillRef.current,
      fillColor: manualStyleRef.current.fillColor,
      strokeColor: manualStyleRef.current.strokeColor,
      strokeWidth,
      radius: manualStyleRef.current.radius,
      ...(colorStopsOverride &&
        colorStopsOverride.length > 0 && { colorStopsOverride }),
    };

    saveSymbology({
      model,
      layerId,
      isStorySegmentOverride,
      segmentId,
      payload: {
        symbologyState,
      },
      mutateLayerBeforeSave: targetLayer => {
        if (targetLayer.type === 'HeatmapLayer') {
          targetLayer.type = 'VectorLayer';
        }
        if (targetLayer.parameters?.color !== undefined) {
          delete targetLayer.parameters.color;
        }
      },
    });
  };

  useOkSignal(okSignalPromise, handleOk);

  const handleReset = (method: SymbologyTab) => {
    if (!layer?.parameters) {
      return;
    }
    const state = { ...(layer.parameters.symbologyState ?? {}) };

    if (method === 'color') {
      delete state.fillColor;
      delete state.strokeColor;
      state.colorRamp = undefined;
      setStopRows([]);
    }

    if (method === 'radius') {
      delete state.radius;
    }

    layer.parameters.symbologyState = state as IVectorLayer['symbologyState'];
    if (layer.parameters.color !== undefined) {
      delete layer.parameters.color;
    }

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
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flex: '1 0 50%',
                      maxWidth: '50%',
                    }}
                  >
                    <div
                      style={{
                        opacity: strokeFollowsFill ? 0.3 : 1,
                        pointerEvents: strokeFollowsFill ? 'none' : 'auto',
                      }}
                    >
                      <RgbaColorPicker
                        color={manualStyle.strokeColor}
                        onChange={color =>
                          setManualStyle(prev => ({
                            ...prev,
                            strokeColor: color,
                          }))
                        }
                      />
                    </div>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={strokeFollowsFill}
                        onChange={e => setStrokeFollowsFill(e.target.checked)}
                      />
                      match fill
                    </label>
                  </div>
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
                <div className="jp-gis-symbology-row">
                  <label>Fallback Color:</label>
                  <RgbaColorPicker
                    color={fallbackColor}
                    onChange={setFallbackColor}
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
              setStopRows={handleManualStopEdit}
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
