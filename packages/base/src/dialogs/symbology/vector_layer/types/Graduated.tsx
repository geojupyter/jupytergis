import { IVectorLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useState } from 'react';

import { VectorClassifications } from '@/src/dialogs/symbology/classificationModes';
import ColorRampControls, {
  ColorRampControlsOptions,
} from '@/src/dialogs/symbology/components/color_ramp/ColorRampControls';
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
import { ColorRampName, ClassificationMode } from '@/src/types';
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
  const [colorManualStyle, setColorManualStyle] = useState({
    strokeColor: '#3399CC',
    strokeWidth: 1.25,
  });
  const [radiusManualStyle, setRadiusManualStyle] = useState({
    radius: 5,
  });
  const [dataMin, setDataMin] = useState<number | undefined>();
  const [dataMax, setDataMax] = useState<number | undefined>();

  const selectableAttributeRef = useLatest(selectedAttribute);
  const symbologyTabRef = useLatest(symbologyTab);
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

      const isSimpleColor = (val: any) =>
        typeof val === 'string' && /^#?[0-9A-Fa-f]{3,8}$/.test(val);

      setColorManualStyle({
        strokeColor: isSimpleColor(strokeColor)
          ? strokeColor
          : isSimpleColor(circleStrokeColor)
            ? circleStrokeColor
            : '#3399CC',
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
      params.symbologyState?.value ??
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
      // use manual style
    }

    newStyle['stroke-color'] = colorManualStyleRef.current.strokeColor;
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

    const symbologyState = {
      renderType: 'Graduated',
      value: selectableAttributeRef.current,
      method: symbologyTabRef.current,
      colorRamp: colorRampOptionsRef.current?.selectedRamp,
      reverse: colorRampOptionsRef.current?.reverseRamp,
      nClasses: colorRampOptionsRef.current?.numberOfShades,
      mode: colorRampOptionsRef.current?.selectedMode,
      min: colorRampOptionsRef.current?.minValue,
      max: colorRampOptionsRef.current?.maxValue,
      dataMin: colorRampOptionsRef.current?.dataMin,
      dataMax: colorRampOptionsRef.current?.dataMax,
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
    setIsLoading: (isLoading: boolean) => void,
    minValue: number,
    maxValue: number,
    criticalValue?: number,
  ) => {
    setColorRampOptions({
      selectedRamp,
      reverseRamp,
      numberOfShades,
      selectedMode,
      minValue,
      maxValue,
      criticalValue,
      dataMin,
      dataMax,
    });

    let stops: number[];

    const values = Array.from(selectableAttributesAndValues[selectedAttribute]);

    switch (selectedMode) {
      case 'quantile':
        stops = VectorClassifications.calculateQuantileBreaks(
          values,
          numberOfShades,
        );
        break;
      case 'equal interval':
        stops = VectorClassifications.calculateEqualIntervalBreaks(
          numberOfShades,
          minValue,
          maxValue,
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
        ? stops.map(v => {
            const scaled =
              minValue !== undefined && maxValue !== undefined
                ? minValue +
                  ((v - Math.min(...stops)) /
                    (Math.max(...stops) - Math.min(...stops))) *
                    (maxValue - minValue)
                : v;
            return { stop: scaled, output: scaled };
          })
        : Utils.getValueColorPairs(
            stops,
            selectedRamp,
            numberOfShades,
            reverseRamp,
            'Graduated',
            minValue,
            maxValue,
          );

    if (symbologyTab === 'radius') {
      setRadiusStopRows(stopOutputPairs);
    } else {
      setColorStopRows(stopOutputPairs);
    }

    setIsLoading(false);
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
                  <input
                    type="color"
                    className="jp-mod-styled"
                    value={colorManualStyle.strokeColor}
                    onChange={e => {
                      setColorManualStyle({
                        ...colorManualStyle,
                        strokeColor: e.target.value,
                      });
                    }}
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

          <ColorRampControls
            layerParams={params}
            modeOptions={modeOptions}
            classifyFunc={buildColorInfoFromClassification}
            showModeRow={true}
            showRampSelector={symbologyTab === 'color'}
            renderType="Graduated"
            dataMin={dataMin}
            dataMax={dataMax}
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
