import { IVectorLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';

import ValueSelect from '@/src/dialogs/symbology/vector_layer/components/ValueSelect';
import { ISymbologyDialogWithAttributesProps } from '../../symbologyDialog';

const Canonical: React.FC<ISymbologyDialogWithAttributesProps> = props => {
  const selectedValueRef = useRef<string>();
  const [selectedValue, setSelectedValue] = useState('');

  if (!props.layerId) {
    return;
  }
  const layer = props.model.getLayer(props.layerId);
  if (!layer?.parameters) {
    return;
  }

  useEffect(() => {
    props.okSignalPromise.promise.then(okSignal => {
      okSignal.connect(handleOk, this);
    });

    return () => {
      props.okSignalPromise.promise.then(okSignal => {
        okSignal.disconnect(handleOk, this);
      });
    };
  }, [selectedValue]);

  useEffect(() => {
    const layerParams = layer.parameters as IVectorLayer;
    const value =
      layerParams.symbologyState?.value ??
      Object.keys(props.selectableAttributesAndValues)[0];

    setSelectedValue(value);
  }, [props.selectableAttributesAndValues]);

  useEffect(() => {
    selectedValueRef.current = selectedValue;
  }, [selectedValue]);

  const handleOk = () => {
    if (!props.layerId) {
      throw new Error('Layer ID is required for symbology update');
    }
    if (!layer.parameters) {
      return;
    }

    const colorExpr: ExpressionValue[] = ['get', selectedValue];
    const newStyle = { ...layer.parameters.color };
    newStyle['fill-color'] = colorExpr;
    newStyle['stroke-color'] = colorExpr;
    newStyle['circle-fill-color'] = colorExpr;

    const symbologyState = {
      renderType: 'Canonical',
      value: selectedValueRef.current,
    };

    layer.parameters.symbologyState = symbologyState;
    layer.parameters.color = newStyle;
    if (layer.type === 'HeatmapLayer') {
      layer.type = 'VectorLayer';
    }

    props.model.sharedModel.updateLayer(props.layerId, layer);
    props.cancel();
  };

  const body = (() => {
    if (Object.keys(props.selectableAttributesAndValues)?.length === 0) {
      return (
        <p className="errors">
          This symbology type is not available; no attributes contain a hex
          color code.
        </p>
      );
    } else {
      return (
        <ValueSelect
          featureProperties={props.selectableAttributesAndValues}
          selectedValue={selectedValue}
          setSelectedValue={setSelectedValue}
        />
      );
    }
  })();

  return (
    <div className="jp-gis-layer-symbology-container">
      <p>Color features based on an attribute containing a hex color code.</p>
      {body}
    </div>
  );
};

export default Canonical;
