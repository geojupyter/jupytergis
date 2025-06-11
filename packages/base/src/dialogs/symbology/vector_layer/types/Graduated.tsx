import { IVectorLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';

import { VectorClassifications } from '@/src/dialogs/symbology/classificationModes';
import ColorRamp, {
  ColorRampOptions,
} from '@/src/dialogs/symbology/components/color_ramp/ColorRamp';
import StopContainer from '@/src/dialogs/symbology/components/color_stops/StopContainer';
import { useGetProperties } from '@/src/dialogs/symbology/hooks/useGetProperties';
import {
  IStopRow,
  ISymbologyTabbedDialogProps,
} from '@/src/dialogs/symbology/symbologyDialog';
import { Utils, VectorUtils } from '@/src/dialogs/symbology/symbologyUtils';
import ValueSelect from '@/src/dialogs/symbology/vector_layer/components/ValueSelect';
import { getNumericFeatureAttributes } from '@/src/tools';

const Graduated: React.FC<ISymbologyTabbedDialogProps> = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId,
  symbologyTab,
}) => {
  const modeOptions = [
    'quantile',
    'equal interval',
    'jenks',
    'pretty',
    'logarithmic',
  ];

  const selectedValueRef = useRef<string>();
  const symbologyTabRef = useRef<string>();
  const colorStopRowsRef = useRef<IStopRow[]>([]);
  const radiusStopRowsRef = useRef<IStopRow[]>([]);
  const colorRampOptionsRef = useRef<ColorRampOptions | undefined>();

  const [selectedValue, setSelectedValue] = useState('');
  const [features, setFeatures] = useState<Record<string, Set<number>>>({});
  const [colorStopRows, setColorStopRows] = useState<IStopRow[]>([]);
  const [radiusStopRows, setRadiusStopRows] = useState<IStopRow[]>([]);
  const [colorRampOptions, setColorRampOptions] = useState<
    ColorRampOptions | undefined
  >();
  const [colorManualStyle, setColorManualStyle] = useState({
    fillColor: '#3399CC',
    strokeColor: '#3399CC',
    strokeWidth: 1.25,
  });
  const [radiusManualStyle, setRadiusManualStyle] = useState({
    radius: 5,
  });

  const colorManualStyleRef = useRef(colorManualStyle);
  const radiusManualStyleRef = useRef(radiusManualStyle);

  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  const { featureProperties } = useGetProperties({
    layerId,
    model: model,
  });

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
      const fillColor = layer.parameters.color['fill-color'];
      const circleFillColor = layer.parameters.color['circle-fill-color'];
      const strokeColor = layer.parameters.color['stroke-color'];
      const circleStrokeColor = layer.parameters.color['circle-stroke-color'];

      const isSimpleColor = (val: any) =>
        typeof val === 'string' && /^#?[0-9A-Fa-f]{3,8}$/.test(val);

      setColorManualStyle({
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
      });
      setRadiusManualStyle({
        radius: layer.parameters.color['circle-radius'] || 5,
      });
    }
  }, [layerId]);

  useEffect(() => {
    colorStopRowsRef.current = colorStopRows;
    radiusStopRowsRef.current = radiusStopRows;
    selectedValueRef.current = selectedValue;
    symbologyTabRef.current = symbologyTab;
    colorRampOptionsRef.current = colorRampOptions;
  }, [
    colorStopRows,
    radiusStopRows,
    selectedValue,
    symbologyTab,
    colorRampOptions,
  ]);

  useEffect(() => {
    colorManualStyleRef.current = colorManualStyle;
    radiusManualStyleRef.current = radiusManualStyle;
  }, [colorManualStyle, radiusManualStyle]);

  useEffect(() => {
    // We only want number values here
    const numericFeatures = getNumericFeatureAttributes(featureProperties);

    setFeatures(numericFeatures);

    const layerParams = layer.parameters as IVectorLayer;
    const value =
      layerParams.symbologyState?.value ?? Object.keys(numericFeatures)[0];

    setSelectedValue(value);
  }, [featureProperties]);

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
        ['get', selectedValueRef.current],
      ];
      colorStopRowsRef.current.forEach(stop => {
        colorExpr.push(stop.stop);
        colorExpr.push(stop.output);
      });
      newStyle['fill-color'] = colorExpr;
      newStyle['circle-fill-color'] = colorExpr;
    } else {
      newStyle['fill-color'] = undefined;
      newStyle['circle-fill-color'] = undefined;
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
        ['get', selectedValueRef.current],
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
      value: selectedValueRef.current,
      method: symbologyTabRef.current,
      colorRamp: colorRampOptionsRef.current?.selectedRamp,
      nClasses: colorRampOptionsRef.current?.numberOfShades,
      mode: colorRampOptionsRef.current?.selectedMode,
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
    selectedRamp: string,
  ) => {
    setColorRampOptions({
      selectedRamp,
      numberOfShades,
      selectedMode,
    });

    let stops;

    const values = Array.from(features[selectedValue]);

    switch (selectedMode) {
      case 'quantile':
        stops = VectorClassifications.calculateQuantileBreaks(
          values,
          +numberOfShades,
        );
        break;
      case 'equal interval':
        stops = VectorClassifications.calculateEqualIntervalBreaks(
          values,
          +numberOfShades,
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
        ? stops.map(v => ({ stop: v, output: v }))
        : Utils.getValueColorPairs(stops, selectedRamp, +numberOfShades);

    if (symbologyTab === 'radius') {
      setRadiusStopRows(stopOutputPairs);
    } else {
      setColorStopRows(stopOutputPairs);
    }
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

  return (
    <div className="jp-gis-layer-symbology-container">
      <ValueSelect
        featureProperties={features}
        selectedValue={selectedValue}
        setSelectedValue={setSelectedValue}
      />
      <div className="jp-gis-layer-symbology-container">
        {symbologyTab === 'color' && (
          <>
            <div className="jp-gis-symbology-row">
              <label>Fill Color:</label>
              <input
                type="color"
                className="jp-mod-styled"
                value={colorManualStyle.fillColor}
                onChange={e => {
                  handleReset('color');
                  setColorManualStyle({
                    ...colorManualStyle,
                    fillColor: e.target.value,
                  });
                }}
              />
            </div>
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
      />
      <StopContainer
        selectedMethod={symbologyTab || 'color'}
        stopRows={symbologyTab === 'color' ? colorStopRows : radiusStopRows}
        setStopRows={
          symbologyTab === 'color' ? setColorStopRows : setRadiusStopRows
        }
      />
    </div>
  );
};

export default Graduated;
