import React, { useEffect, useRef, useState } from 'react';
import ValueSelect from '../components/ValueSelect';
import { IStopRow, ISymbologyDialogProps } from '../../symbologyDialog';
import { useGetProperties } from '../../hooks/useGetProperties';
import StopContainer from '../../components/color_stops/StopContainer';
import { Utils, VectorUtils } from '../../symbologyUtils';
import ColorRamp from '../../components/color_ramp/ColorRamp';
import { ReadonlyJSONObject } from '@lumino/coreutils';
import { ExpressionValue } from 'ol/expr/expression';
import { IVectorLayer } from '@jupytergis/schema';

const Categorized = ({
  context,
  state,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const selectedValueRef = useRef<string>();
  const stopRowsRef = useRef<IStopRow[]>();
  const colorRampOptionsRef = useRef<ReadonlyJSONObject | undefined>();

  const [selectedValue, setSelectedValue] = useState('');
  const [stopRows, setStopRows] = useState<IStopRow[]>([]);
  const [colorRampOptions, setColorRampOptions] = useState<
    ReadonlyJSONObject | undefined
  >();

  if (!layerId) {
    return;
  }
  const layer = context.model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }
  const { featureProps } = useGetProperties({
    layerId,
    model: context.model
  });

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
    populateOptions();
  }, [featureProps]);

  useEffect(() => {
    selectedValueRef.current = selectedValue;
    stopRowsRef.current = stopRows;
    colorRampOptionsRef.current = colorRampOptions;
  }, [selectedValue, stopRows, colorRampOptions]);

  const populateOptions = async () => {
    const layerParams = layer.parameters as IVectorLayer;
    const value =
      layerParams.symbologyState?.value ?? Object.keys(featureProps)[0];

    setSelectedValue(value);
  };

  const buildColorInfoFromClassification = (
    selectedMode: string,
    numberOfShades: string,
    selectedRamp: string,
    setIsLoading: (isLoading: boolean) => void
  ) => {
    setColorRampOptions({
      selectedFunction: '',
      selectedRamp,
      numberOfShades: '',
      selectedMode: ''
    });

    const stops = Array.from(featureProps[selectedValue]).sort((a, b) => a - b);

    const valueColorPairs = Utils.getValueColorPairs(
      stops,
      selectedRamp,
      stops.length
    );

    setStopRows(valueColorPairs);
  };

  const handleOk = () => {
    if (!layer.parameters) {
      return;
    }

    const colorExpr: ExpressionValue[] = [];
    colorExpr.push('case');

    stopRowsRef.current?.map(stop => {
      colorExpr.push(['==', ['get', selectedValueRef.current], stop.stop]);
      colorExpr.push(stop.output);
    });

    // fallback value
    colorExpr.push([0, 0, 0, 0.0]);

    const newStyle = { ...layer.parameters.color };
    newStyle['circle-fill-color'] = colorExpr;

    const symbologyState = {
      renderType: 'Categorized',
      value: selectedValueRef.current,
      colorRamp: colorRampOptionsRef.current?.selectedRamp,
      nClasses: colorRampOptionsRef.current?.numberOfShades,
      mode: colorRampOptionsRef.current?.selectedMode
    };

    layer.parameters.symbologyState = symbologyState;
    layer.parameters.color = newStyle;

    context.model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  return (
    <div className="jp-gis-layer-symbology-container">
      <ValueSelect
        featureProperties={featureProps}
        selectedValue={selectedValue}
        setSelectedValue={setSelectedValue}
      />

      <ColorRamp
        layerParams={layer.parameters}
        modeOptions={[]}
        classifyFunc={buildColorInfoFromClassification}
        showModeRow={false}
      />
      <StopContainer
        selectedMethod={''}
        stopRows={stopRows}
        setStopRows={setStopRows}
      />
    </div>
  );
};

export default Categorized;
