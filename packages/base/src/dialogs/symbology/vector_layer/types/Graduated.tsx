import { IVectorLayer } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import React, { useEffect, useRef, useState } from 'react';

import { VectorClassifications } from '@/src/dialogs/symbology/classificationModes';
import {
  colorToRgba,
  DEFAULT_COLOR,
  DEFAULT_STROKE_WIDTH,
  getColorMap,
  RgbaColor,
} from '@/src/dialogs/symbology/colorRampUtils';
import ColorRampControls, {
  ColorRampControlsOptions,
} from '@/src/dialogs/symbology/components/color_ramp/ColorRampControls';
import RgbaColorPicker from '@/src/dialogs/symbology/components/color_ramp/RgbaColorPicker';
import StopContainer from '@/src/dialogs/symbology/components/color_stops/StopContainer';
import { useOkSignal } from '@/src/dialogs/symbology/hooks/useOkSignal';
import {
  IStopRow,
  ISymbologyTabbedDialogWithAttributesProps,
} from '@/src/dialogs/symbology/symbologyDialog';
import {
  saveSymbology,
  Utils,
  VectorSymbologyParams,
} from '@/src/dialogs/symbology/symbologyUtils';
import ValueSelect from '@/src/dialogs/symbology/vector_layer/components/ValueSelect';
import { useLatest } from '@/src/shared/hooks/useLatest';
import { ClassificationMode } from '@/src/types';
import { ColorRampName } from '../../colorRampUtils';
import { useEffectiveSymbologyParams } from '../../hooks/useEffectiveSymbologyParams';

const Graduated: React.FC<ISymbologyTabbedDialogWithAttributesProps> = ({
  model,
  okSignalPromise,
  layerId,
  symbologyTab,
  selectableAttributesAndValues,
  isStorySegmentOverride,
  segmentId,
}) => {
  const modeOptions = [
    'quantile',
    'equal interval',
    'jenks',
    'pretty',
    'logarithmic',
  ] as const satisfies ClassificationMode[];

  const [selectedAttribute, setSelectedAttribute] = useState('');
  const [colorStopRows, setColorStopRows] = useState<IStopRow[]>([]);
  const [radiusStopRows, setRadiusStopRows] = useState<IStopRow[]>([]);
  const [colorRampOptions, setColorRampOptions] = useState<
    ColorRampControlsOptions | undefined
  >();
  const [fallbackColor, setFallbackColor] = useState<RgbaColor>([0, 0, 0, 0]);
  const [strokeFollowsFill, setStrokeFollowsFill] = useState(false);
  const fallbackColorRef = useLatest(fallbackColor);
  const strokeFollowsFillRef = useLatest(strokeFollowsFill);
  const [colorManualStyle, setColorManualStyle] = useState<{
    strokeColor: RgbaColor;
    strokeWidth: string;
  }>({
    strokeColor: DEFAULT_COLOR,
    strokeWidth: String(DEFAULT_STROKE_WIDTH),
  });
  const [radiusManualStyle, setRadiusManualStyle] = useState({
    radius: 5,
  });
  const [vmin, setVmin] = useState<string>('');
  const [vmax, setVmax] = useState<string>('');

  const selectableAttributeRef = useLatest(selectedAttribute);
  const symbologyTabRef = useLatest(symbologyTab);
  const vminRef = useLatest(vmin);
  const vmaxRef = useLatest(vmax);
  const colorRampOptionsRef = useLatest(colorRampOptions);

  const colorManualStyleRef = useLatest(colorManualStyle);
  const radiusManualStyleRef = useLatest(radiusManualStyle);

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

  // Auto-classify on first load once selectedAttribute + vmin/vmax are ready.
  const hasAutoClassified = useRef(false);

  useEffect(() => {
    const state = params.symbologyState;
    if (state) {
      setColorManualStyle({
        strokeColor: colorToRgba(state.strokeColor ?? DEFAULT_COLOR),
        strokeWidth: String(state.strokeWidth ?? DEFAULT_STROKE_WIDTH),
      });
      setRadiusManualStyle({
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

  useEffect(() => {
    if (
      !selectedAttribute ||
      !selectableAttributesAndValues[selectedAttribute]
    ) {
      return;
    }
    if (params.symbologyState?.vmin !== undefined) {
      setVmin(String(params.symbologyState.vmin));
      setVmax(String(params.symbologyState.vmax ?? ''));
      return;
    }
    const values = Array.from(
      selectableAttributesAndValues[selectedAttribute],
    ).filter(Number.isFinite);
    if (values.length === 0) {
      return;
    }
    setVmin(String(Math.min(...values)));
    setVmax(String(Math.max(...values)));
  }, [selectedAttribute]);

  // Once selectedAttribute + vmin + vmax are populated, auto-classify using saved config.
  useEffect(() => {
    if (hasAutoClassified.current) {
      return;
    }
    if (!selectedAttribute || !vmin || !vmax) {
      return;
    }
    if (!selectableAttributesAndValues[selectedAttribute]) {
      return;
    }
    const state = params.symbologyState;
    if (state?.renderType === 'Graduated') {
      hasAutoClassified.current = true;
      buildColorInfoFromClassification(
        (state.mode ?? 'equal interval') as ClassificationMode,
        state.nClasses ?? 9,
        (state.colorRamp ?? 'viridis') as ColorRampName,
        state.reverseRamp ?? false,
      );
    }
  }, [selectedAttribute, vmin, vmax]);

  const handleOk = () => {
    const strokeWidth = Math.max(
      0,
      parseFloat(colorManualStyleRef.current.strokeWidth),
    );

    const parsedVmin = parseFloat(vminRef.current);
    const parsedVmax = parseFloat(vmaxRef.current);

    type SymbologyState = NonNullable<IVectorLayer['symbologyState']>;
    const method =
      symbologyTabRef.current === 'radius'
        ? ('radius' as const)
        : ('color' as const);
    // Only persist the minimal config — stops are computed at runtime from
    // nClasses + colorRamp + mode + feature values.
    const symbologyState: SymbologyState = {
      renderType: 'Graduated',
      value: selectableAttributeRef.current,
      method,
      colorRamp: colorRampOptionsRef.current?.selectedRamp,
      nClasses: colorRampOptionsRef.current?.numberOfShades,
      mode: colorRampOptionsRef.current?.selectedMode as SymbologyState['mode'],
      reverseRamp: colorRampOptionsRef.current?.reverseRamp,
      fallbackColor: fallbackColorRef.current,
      strokeFollowsFill: strokeFollowsFillRef.current,
      strokeColor: colorManualStyleRef.current.strokeColor,
      strokeWidth,
      radius: radiusManualStyleRef.current.radius,
      ...(Number.isFinite(parsedVmin) && { vmin: parsedVmin }),
      ...(Number.isFinite(parsedVmax) && { vmax: parsedVmax }),
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
        // Drop any legacy color cache — symbologyState is the source of truth now.
        if (targetLayer.parameters?.color !== undefined) {
          delete targetLayer.parameters.color;
        }
      },
    });
  };

  useOkSignal(okSignalPromise, handleOk);

  const buildColorInfoFromClassification = (
    selectedMode: ClassificationMode,
    numberOfShades: number,
    selectedRamp: ColorRampName,
    reverseRamp: boolean,
  ) => {
    setColorRampOptions({
      selectedRamp,
      numberOfShades,
      selectedMode,
      reverseRamp,
    });

    let stops: number[];

    if (!selectableAttributesAndValues[selectedAttribute]) {
      return;
    }
    const allValues = Array.from(
      selectableAttributesAndValues[selectedAttribute],
    );
    const parsed = (s: string) => {
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : undefined;
    };
    const parsedVmin = parsed(vmin);
    const parsedVmax = parsed(vmax);
    const values = allValues.filter(v => {
      if (!Number.isFinite(v)) {
        return false;
      }
      if (parsedVmin !== undefined && v < parsedVmin) {
        return false;
      }
      if (parsedVmax !== undefined && v > parsedVmax) {
        return false;
      }
      return true;
    });

    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const rangeMin = parsedVmin ?? dataMin;
    const rangeMax = parsedVmax ?? dataMax;
    const rangeValues = [rangeMin, rangeMax];

    switch (selectedMode) {
      case 'quantile':
        stops = VectorClassifications.calculateQuantileBreaks(
          values,
          numberOfShades,
        );
        break;
      case 'equal interval':
        stops = VectorClassifications.calculateEqualIntervalBreaks(
          rangeValues,
          numberOfShades,
        );
        break;
      case 'jenks':
        stops = VectorClassifications.calculateJenksBreaks(
          values,
          numberOfShades,
        );
        break;
      case 'pretty':
        stops = VectorClassifications.calculatePrettyBreaks(
          rangeValues,
          numberOfShades,
        );
        break;
      case 'logarithmic':
        stops = VectorClassifications.calculateLogarithmicBreaks(
          rangeValues,
          numberOfShades,
        );
        break;
      default:
        console.warn('No mode selected');
        return;
    }

    // Pin outer stops to the user-specified range for all modes.
    // Range-based modes (equal interval, pretty, logarithmic) already receive
    // rangeValues so their outer stops are correct; this clamp ensures
    // data-driven modes (quantile, jenks) also honour vmin/vmax at the edges,
    // which is useful e.g. for excluding outliers while keeping the ramp
    // anchored to the chosen range.
    if (stops.length > 0) {
      stops[0] = rangeMin;
      stops[stops.length - 1] = rangeMax;
    }

    const colorRamp = getColorMap(selectedRamp);
    const getStopOutputPairs = (): IStopRow[] => {
      if (symbologyTab === 'radius') {
        return stops.map(v => ({ id: UUID.uuid4(), stop: v, output: v }));
      }

      return colorRamp
        ? Utils.getValueColorPairs(
            stops,
            colorRamp,
            numberOfShades,
            reverseRamp,
          )
        : [];
    };

    const stopOutputPairs = getStopOutputPairs();

    if (symbologyTab === 'radius') {
      setRadiusStopRows(stopOutputPairs);
    } else {
      setColorStopRows(stopOutputPairs);
    }
  };

  const handleReset = (method: string) => {
    const layer = model.getLayer(layerId);
    if (!layer?.parameters) {
      return;
    }
    const state = { ...(layer.parameters.symbologyState ?? {}) };

    if (method === 'color') {
      setColorStopRows([]);
      setColorRampOptions(undefined);
    }

    if (method === 'radius') {
      setRadiusStopRows([]);
    }

    layer.parameters.symbologyState = state as IVectorLayer['symbologyState'];
    // Drop any stale legacy color cache.
    if (layer.parameters.color !== undefined) {
      delete layer.parameters.color;
    }
    model.sharedModel.updateLayer(layerId, layer);
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
            selectedValue={selectedAttribute}
            setSelectedValue={setSelectedAttribute}
          />
          <div className="jp-gis-layer-symbology-container">
            {symbologyTab === 'color' && (
              <>
                <p className="jp-info-text">
                  Fill color is automatically controlled by the color ramp. To
                  control fill manually, switch to <strong>Simple</strong>{' '}
                  symbology.
                </p>
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
                        color={colorManualStyle.strokeColor}
                        onChange={color =>
                          setColorManualStyle(prev => ({
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
                    value={colorManualStyle.strokeWidth}
                    onChange={e => {
                      setColorManualStyle({
                        ...colorManualStyle,
                        strokeWidth: e.target.value,
                      });
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
                  value={radiusManualStyle.radius}
                  onChange={e => {
                    handleReset('radius');
                    setRadiusManualStyle({
                      ...radiusManualStyle,
                      radius: +e.target.value,
                    });
                  }}
                />
              </div>
            )}
          </div>

          <div className="jp-gis-symbology-row">
            <label>Min value:</label>
            <input
              type="text"
              className="jp-mod-styled"
              placeholder="auto"
              value={vmin}
              onChange={e => setVmin(e.target.value)}
            />
          </div>
          <div className="jp-gis-symbology-row">
            <label>Max value:</label>
            <input
              type="text"
              className="jp-mod-styled"
              placeholder="auto"
              value={vmax}
              onChange={e => setVmax(e.target.value)}
            />
          </div>
          <ColorRampControls
            layerParams={params}
            modeOptions={modeOptions}
            classifyFunc={buildColorInfoFromClassification}
            showModeRow={true}
            showRampSelector={symbologyTab === 'color'}
          />
          <StopContainer
            selectedMethod={symbologyTab || 'color'}
            stopRows={symbologyTab === 'color' ? colorStopRows : radiusStopRows}
            setStopRows={
              symbologyTab === 'color' ? setColorStopRows : setRadiusStopRows
            }
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
