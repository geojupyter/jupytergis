import { IVectorLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';

import { VectorClassifications } from '@/src/dialogs/symbology/classificationModes';
import ColorRamp, {
  ColorRampOptions,
} from '@/src/dialogs/symbology/components/color_ramp/ColorRamp';
import StopContainer from '@/src/dialogs/symbology/components/color_stops/StopContainer';
import {
  IStopRow,
  ISymbologyTabbedDialogWithAttributesProps,
} from '@/src/dialogs/symbology/symbologyDialog';
import { Utils, VectorUtils } from '@/src/dialogs/symbology/symbologyUtils';
import ValueSelect from '@/src/dialogs/symbology/vector_layer/components/ValueSelect';
import { ColorRampName } from '@/src/types';

const Graduated: React.FC<ISymbologyTabbedDialogWithAttributesProps> = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId,
  symbologyTab,
  selectableAttributesAndValues,
}) => {
  const modeOptions = [
    'quantile',
    'equal interval',
    'jenks',
    'pretty',
    'logarithmic',
  ];

  const selectableAttributeRef = useRef<string>();
  const symbologyTabRef = useRef<string>();
  const colorStopRowsRef = useRef<IStopRow[]>([]);
  const radiusStopRowsRef = useRef<IStopRow[]>([]);

  const [selectedAttribute, setSelectedAttribute] = useState('');
  const [colorStopRows, setColorStopRows] = useState<IStopRow[]>([]);
  const [radiusStopRows, setRadiusStopRows] = useState<IStopRow[]>([]);
  const [colorRampOptions, setColorRampOptions] = useState<
    ColorRampOptions | undefined
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

  const colorRampOptionsRef = useRef<ColorRampOptions | undefined>();
  const colorManualStyleRef = useRef(colorManualStyle);
  const radiusManualStyleRef = useRef(radiusManualStyle);

  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  useEffect(() => {
    updateStopRowsBasedOnLayer();

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
      const strokeColor = layer.parameters.color['stroke-color'];
      const circleStrokeColor = layer.parameters.color['circle-stroke-color'];

      const isSimpleColor = (val: any) =>
        typeof val === 'string' && /^#?[0-9A-Fa-f]{3,8}$/.test(val);

      setColorManualStyle({
        strokeColor: isSimpleColor(strokeColor)
          ? strokeColor
          : isSimpleColor(circleStrokeColor)
            ? circleStrokeColor
            : '#3399CC',
        strokeWidth:
          layer.parameters.color['stroke-width'] ||
          layer.parameters.color['circle-stroke-width'] ||
          1.25,
      });
      setRadiusManualStyle({
        radius: layer.parameters.color['circle-radius'] || 5,
      });
    }
  }, [layerId]);

  useEffect(() => {
    colorStopRowsRef.current = colorStopRows;
    radiusStopRowsRef.current = radiusStopRows;
    selectableAttributeRef.current = selectedAttribute;
    symbologyTabRef.current = symbologyTab;
    colorRampOptionsRef.current = colorRampOptions;
  }, [
    colorStopRows,
    radiusStopRows,
    selectedAttribute,
    symbologyTab,
    colorRampOptions,
  ]);

  useEffect(() => {
    colorManualStyleRef.current = colorManualStyle;
    radiusManualStyleRef.current = radiusManualStyle;
  }, [colorManualStyle, radiusManualStyle]);

  useEffect(() => {
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

  const updateStopRowsBasedOnLayer = () => {
    if (!layer) {
      return;
    }

    setColorStopRows(VectorUtils.buildColorInfo(layer));
    setRadiusStopRows(VectorUtils.buildRadiusInfo(layer));
  };

  const handleOk = () => {
    if (!layer.parameters) {
      return;
    }

    const newStyle = { ...layer.parameters.color };

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

    layer.parameters.color = newStyle;
    layer.parameters.symbologyState = {
      renderType: 'Graduated',
      value: selectableAttributeRef.current,
      method: symbologyTabRef.current,
      colorRamp: colorRampOptionsRef.current?.selectedRamp,
      reverse: colorRampOptionsRef.current?.reverseRamp,
      nClasses: colorRampOptionsRef.current?.numberOfShades,
      mode: colorRampOptionsRef.current?.selectedMode,
      min: colorRampOptionsRef.current?.minValue,
      max: colorRampOptionsRef.current?.maxValue,
    };

    if (layer.type === 'HeatmapLayer') {
      layer.type = 'VectorLayer';
    }

    model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  const buildColorInfoFromClassification = (
    selectedMode: string,
    numberOfShades: string,
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
    });

    let stops: number[];

    const values = Array.from(selectableAttributesAndValues[selectedAttribute]);

    switch (selectedMode) {
      case 'quantile':
        stops = VectorClassifications.calculateQuantileBreaks(
          values,
          +numberOfShades,
        );
        break;
      case 'equal interval':
        stops = VectorClassifications.calculateEqualIntervalBreaks(
          +numberOfShades,
          minValue,
          maxValue,
        );
        break;
      case 'jenks':
        stops = VectorClassifications.calculateJenksBreaks(
          values,
          +numberOfShades,
        );
        break;
      case 'pretty':
        stops = VectorClassifications.calculatePrettyBreaks(
          values,
          +numberOfShades,
        );
        break;
      case 'logarithmic':
        stops = VectorClassifications.calculateLogarithmicBreaks(
          values,
          +numberOfShades,
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
            +numberOfShades,
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
    if (!layer?.parameters) {
      return;
    }

    const newStyle = { ...layer.parameters.color };

    if (method === 'color') {
      delete newStyle['stroke-color'];
      setColorStopRows([]);
      setColorRampOptions(undefined);
    }

    if (method === 'radius') {
      delete newStyle['circle-radius'];
      setRadiusStopRows([]);
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

          <ColorRamp
            layerParams={layer.parameters}
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
