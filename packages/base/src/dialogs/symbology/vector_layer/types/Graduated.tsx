import { IVectorLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';
import { getNumericFeatureAttributes } from '../../../../tools';
import { VectorClassifications } from '../../classificationModes';
import ColorRamp, {
  ColorRampOptions
} from '../../components/color_ramp/ColorRamp';
import StopContainer from '../../components/color_stops/StopContainer';
import { useGetProperties } from '../../hooks/useGetProperties';
import { IStopRow, ISymbologyDialogProps } from '../../symbologyDialog';
import { Utils, VectorUtils } from '../../symbologyUtils';
import ValueSelect from '../components/ValueSelect';

const Graduated = ({
  model,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const modeOptions = [
    'quantile',
    'equal interval',
    'jenks',
    'pretty',
    'logarithmic'
  ];

  const selectedValueRef = useRef<string>();
  const selectedMethodRef = useRef<Record<string, boolean>>({ color: true });
  const stopRowsColorRef = useRef<IStopRow[]>();
  const stopRowsRadiusRef = useRef<IStopRow[]>();

  const colorRampOptionsRef = useRef<ColorRampOptions | undefined>();

  const [selectedValue, setSelectedValue] = useState('');
  const [enabledMethods, setEnabledMethods] = useState<Record<string, boolean>>(
    {
      color: true,
      radius: false
    }
  );

  const [stopRowsColor, setStopRowsColor] = useState<IStopRow[]>([]);
  const [stopRowsRadius, setStopRowsRadius] = useState<IStopRow[]>([]);

  const [features, setFeatures] = useState<Record<string, Set<number>>>({});
  const [colorRampOptions, setColorRampOptions] = useState<
    ColorRampOptions | undefined
  >();

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

  const toggleMethod = (method: keyof typeof enabledMethods) => {
    setEnabledMethods(prev => ({
      ...prev,
      [method]: !prev[method]
    }));
  };

  useEffect(() => {
    const layerParams = layer.parameters as IVectorLayer;
    const methodObj = layerParams.symbologyState?.method ?? {
      color: true,
      radius: false
    };
    setEnabledMethods(methodObj);

    if (methodObj.color) {
      const colorStops = VectorUtils.buildColorInfo(layer);
      setStopRowsColor(colorStops);
    }

    if (methodObj.radius) {
      const radiusStops = VectorUtils.buildRadiusInfo(layer);
      setStopRowsRadius(radiusStops);
    }

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
    updateStopRowsBasedOnMethod();
  }, [enabledMethods]);

  useEffect(() => {
    selectedValueRef.current = selectedValue;
    selectedMethodRef.current = enabledMethods;
    stopRowsColorRef.current = stopRowsColor;
    stopRowsRadiusRef.current = stopRowsRadius;
    colorRampOptionsRef.current = colorRampOptions;
  }, [
    selectedValue,
    enabledMethods,
    stopRowsColor,
    stopRowsRadius,
    colorRampOptions
  ]);

  useEffect(() => {
    const numericFeatures = getNumericFeatureAttributes(featureProperties);
    setFeatures(numericFeatures);

    const layerParams = layer.parameters as IVectorLayer;
    const value =
      layerParams.symbologyState?.value ?? Object.keys(numericFeatures)[0];
    const method: Record<string, boolean> = layerParams.symbologyState
      ?.method ?? { color: true, radius: false };

    setSelectedValue(value);
    setEnabledMethods(method);

    if (method.color) {
      setStopRowsColor(VectorUtils.buildColorInfo(layer));
    }

    if (method.radius) {
      setStopRowsRadius(VectorUtils.buildRadiusInfo(layer));
    }
  }, [featureProperties]);

  const updateStopRowsBasedOnMethod = () => {
    if (!layer || !enabledMethods) {
      return;
    }

    if (enabledMethods.color) {
      const colorStops = VectorUtils.buildColorInfo(layer);
      setStopRowsColor(colorStops);
    }

    if (enabledMethods.radius) {
      const radiusStops = VectorUtils.buildRadiusInfo(layer);
      setStopRowsRadius(radiusStops);
    }
  };

  const handleOk = () => {
    if (!layer.parameters) {
      return;
    }

    const newStyle = { ...layer.parameters.color };

    if (selectedMethodRef.current.color) {
      const colorExpr: ExpressionValue[] = [
        'interpolate',
        ['linear'],
        ['get', selectedValueRef.current]
      ];

      stopRowsColorRef.current?.forEach(stop => {
        colorExpr.push(stop.stop);
        colorExpr.push(stop.output);
      });

      newStyle['fill-color'] = colorExpr;
      newStyle['stroke-color'] = colorExpr;
      newStyle['circle-fill-color'] = colorExpr;
    }

    if (selectedMethodRef.current.radius) {
      const radiusExpr: ExpressionValue[] = [
        'interpolate',
        ['linear'],
        ['get', selectedValueRef.current]
      ];

      stopRowsRadiusRef.current?.forEach(stop => {
        radiusExpr.push(stop.stop);
        radiusExpr.push(stop.output);
      });

      newStyle['circle-radius'] = radiusExpr;
    }

    const symbologyState = {
      renderType: 'Graduated',
      value: selectedValueRef.current,
      method: selectedMethodRef.current,
      colorRamp: colorRampOptionsRef.current?.selectedRamp,
      nClasses: colorRampOptionsRef.current?.numberOfShades,
      mode: colorRampOptionsRef.current?.selectedMode
    };

    layer.parameters.symbologyState = symbologyState;
    layer.parameters.color = newStyle;
    if (layer.type === 'HeatmapLayer') {
      layer.type = 'VectorLayer';
    }

    model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  const buildColorInfoFromClassification = (
    selectedMode: string,
    numberOfShades: string,
    selectedRamp: string
  ) => {
    setColorRampOptions({
      selectedRamp,
      numberOfShades,
      selectedMode
    });

    let stops;

    const values = Array.from(features[selectedValue]);

    switch (selectedMode) {
      case 'quantile':
        stops = VectorClassifications.calculateQuantileBreaks(
          values,
          +numberOfShades
        );
        break;
      case 'equal interval':
        stops = VectorClassifications.calculateEqualIntervalBreaks(
          values,
          +numberOfShades
        );
        break;
      case 'jenks':
        stops = VectorClassifications.calculateJenksBreaks(
          values,
          +numberOfShades
        );
        break;
      case 'pretty':
        stops = VectorClassifications.calculatePrettyBreaks(
          values,
          +numberOfShades
        );
        break;
      case 'logarithmic':
        stops = VectorClassifications.calculateLogarithmicBreaks(
          values,
          +numberOfShades
        );
        break;
      default:
        console.warn('No mode selected');
        return;
    }

    // Generate stop-output pairs for the enabled methods
    if (enabledMethods.radius) {
      const radiusStops = [];
      for (let i = 0; i < +numberOfShades; i++) {
        radiusStops.push({ stop: stops[i], output: stops[i] });
      }
      setStopRowsRadius(radiusStops);
    }

    if (enabledMethods.color) {
      const colorStops = Utils.getValueColorPairs(
        stops,
        selectedRamp,
        +numberOfShades
      );
      setStopRowsColor(colorStops);
    }
  };

  return (
    <div className="jp-gis-layer-symbology-container">
      <ValueSelect
        featureProperties={features}
        selectedValue={selectedValue}
        setSelectedValue={setSelectedValue}
      />
      <div className="jp-gis-symbology-row">
        <label>
          <input
            type="checkbox"
            checked={enabledMethods.color}
            onChange={() => toggleMethod('color')}
          />
          Color
        </label>
        <label style={{ marginLeft: '1rem' }}>
          <input
            type="checkbox"
            checked={enabledMethods.radius}
            onChange={() => toggleMethod('radius')}
          />
          Radius
        </label>
      </div>
      <ColorRamp
        layerParams={layer.parameters}
        modeOptions={modeOptions}
        classifyFunc={buildColorInfoFromClassification}
        showModeRow={true}
      />
      <div style={{ display: 'flex', gap: '2rem' }}>
        {enabledMethods.color && (
          <StopContainer
            selectedMethod="color"
            stopRows={stopRowsColor}
            setStopRows={setStopRowsColor}
          />
        )}
        {enabledMethods.radius && (
          <StopContainer
            selectedMethod="radius"
            stopRows={stopRowsRadius}
            setStopRows={setStopRowsRadius}
          />
        )}
      </div>
    </div>
  );
};

export default Graduated;
