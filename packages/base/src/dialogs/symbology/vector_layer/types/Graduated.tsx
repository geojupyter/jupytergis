import { IVectorLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useState } from 'react';

import { VectorClassifications } from '@/src/dialogs/symbology/classificationModes';
import ColorRampControls, {
  ColorRampControlsOptions,
} from '@/src/dialogs/symbology/components/color_ramp/ColorRampControls';
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
  saveSymbology,
  Utils,
  VectorSymbologyParams,
  VectorUtils,
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
  const [colorManualStyle, setColorManualStyle] = useState<{
    strokeColor: RgbaColor;
    strokeWidth: number;
  }>({
    strokeColor: DEFAULT_COLOR,
    strokeWidth: 1.25,
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
  const colorStopRowsRef = useLatest(colorStopRows);
  const radiusStopRowsRef = useLatest(radiusStopRows);
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

  useEffect(() => {
    updateStopRowsBasedOnLayer();
  }, []);

  useEffect(() => {
    if (params.color) {
      const strokeColor = params.color['stroke-color'];
      const circleStrokeColor = params.color['circle-stroke-color'];

      const effectiveStroke = isColor(strokeColor)
        ? strokeColor
        : isColor(circleStrokeColor)
          ? circleStrokeColor
          : DEFAULT_COLOR;

      setColorManualStyle({
        strokeColor: colorToRgba(effectiveStroke),
        strokeWidth:
          params.color['stroke-width'] ||
          params.color['circle-stroke-width'] ||
          1.25,
      });
      setRadiusManualStyle({
        radius: params.color['circle-radius'] || 5,
      });
    }
  }, [layerId]);

  useEffect(() => {
    const attribute =
      params.symbologyState?.value ||
      Object.keys(selectableAttributesAndValues)[0];

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

  const updateStopRowsBasedOnLayer = () => {
    if (!layer) {
      return;
    }

    setColorStopRows(VectorUtils.buildColorInfo(params));
    setRadiusStopRows(VectorUtils.buildRadiusInfo(layer));
  };

  const handleOk = () => {
    const newStyle = { ...params.color };

    // Apply color symbology
    if (colorStopRowsRef.current.length > 0) {
      const colorExpr: ExpressionValue[] = [
        'interpolate',
        ['linear'],
        ['get', selectableAttributeRef.current],
      ];
      colorStopRowsRef.current.forEach(stop => {
        colorExpr.push(stop.stop);
        colorExpr.push(stop.output);
      });
      newStyle['fill-color'] = colorExpr;
      newStyle['circle-fill-color'] = colorExpr;
      newStyle['stroke-color'] = colorExpr;
      newStyle['circle-stroke-color'] = colorExpr;
    } else {
      newStyle['stroke-color'] = colorManualStyleRef.current.strokeColor;
    }

    newStyle['circle-stroke-color'] = colorManualStyleRef.current.strokeColor;
    newStyle['stroke-width'] = colorManualStyleRef.current.strokeWidth;
    newStyle['circle-stroke-width'] = colorManualStyleRef.current.strokeWidth;

    // Apply radius symbology
    if (radiusStopRowsRef.current.length > 0) {
      const radiusExpr: ExpressionValue[] = [
        'interpolate',
        ['linear'],
        ['get', selectableAttributeRef.current],
      ];
      radiusStopRowsRef.current.forEach(stop => {
        radiusExpr.push(stop.stop);
        radiusExpr.push(stop.output);
      });
      newStyle['circle-radius'] = radiusExpr;
    } else {
      newStyle['circle-radius'] = radiusManualStyleRef.current.radius;
    }

    const parsedVmin = parseFloat(vminRef.current);
    const parsedVmax = parseFloat(vmaxRef.current);
    const symbologyState = {
      renderType: 'Graduated',
      value: selectableAttributeRef.current,
      method: symbologyTabRef.current,
      colorRamp: colorRampOptionsRef.current?.selectedRamp,
      nClasses: colorRampOptionsRef.current?.numberOfShades,
      mode: colorRampOptionsRef.current?.selectedMode,
      reverseRamp: colorRampOptionsRef.current?.reverseRamp,
      ...(Number.isFinite(parsedVmin) && { vmin: parsedVmin }),
      ...(Number.isFinite(parsedVmax) && { vmax: parsedVmax }),
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

    switch (selectedMode) {
      case 'quantile':
        stops = VectorClassifications.calculateQuantileBreaks(
          values,
          numberOfShades,
        );
        break;
      case 'equal interval':
        stops = VectorClassifications.calculateEqualIntervalBreaks(
          values,
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
          values,
          numberOfShades,
        );
        break;
      case 'logarithmic':
        stops = VectorClassifications.calculateLogarithmicBreaks(
          values,
          numberOfShades,
        );
        break;
      default:
        console.warn('No mode selected');
        return;
    }

    const stopOutputPairs =
      symbologyTab === 'radius'
        ? stops.map(v => ({ stop: v, output: v }))
        : Utils.getValueColorPairs(
            stops,
            selectedRamp,
            numberOfShades,
            reverseRamp,
          );

    if (symbologyTab === 'radius') {
      setRadiusStopRows(stopOutputPairs);
    } else {
      setColorStopRows(stopOutputPairs);
    }
  };

  const handleReset = (method: string) => {
    const newStyle = { ...params.color };

    if (method === 'color') {
      delete newStyle['stroke-color'];
      setColorStopRows([]);
      setColorRampOptions(undefined);
    }

    if (method === 'radius') {
      delete newStyle['circle-radius'];
      setRadiusStopRows([]);
    }

    const layer = model.getLayer(layerId);
    if (!layer?.parameters) {
      return;
    }

    layer.parameters.color = newStyle;
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
                <div className="jp-gis-symbology-row">
                  <label>Stroke Width:</label>
                  <input
                    type="number"
                    className="jp-mod-styled"
                    value={colorManualStyle.strokeWidth}
                    onChange={e => {
                      setColorManualStyle({
                        ...colorManualStyle,
                        strokeWidth: +e.target.value,
                      });
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
