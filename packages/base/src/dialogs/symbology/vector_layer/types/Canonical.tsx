import { IVectorLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';

import { ISymbologyDialogWithAttributesProps } from '../../symbologyDialog';
import ValueSelect from '@/src/dialogs/symbology/vector_layer/components/ValueSelect';

const Canonical = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId,
  selectableAttributesAndValues
}: ISymbologyDialogWithAttributesProps) => {
  const selectedValueRef = useRef<string>();
  const [selectedValue, setSelectedValue] = useState('');

  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  useEffect(() => {
    okSignalPromise.promise.then(okSignal => {
      okSignal.connect(handleOk, this);
    });

    return () => {
      okSignalPromise.promise.then(okSignal => {
        okSignal.disconnect(handleOk, this);
      });
    };
  }, [selectedValue]);

  useEffect(() => {
    const layerParams = layer.parameters as IVectorLayer;
    const value =
      layerParams.symbologyState?.value ?? Object.keys(selectableAttributesAndValues)[0];

    setSelectedValue(value);
  }, [selectableAttributesAndValues]);

  useEffect(() => {
    selectedValueRef.current = selectedValue;
  }, [selectedValue]);

  const handleOk = () => {
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

    model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  debugger;
  if (Object.keys(selectableAttributesAndValues)?.length === 0) {
    return (
      <div className="jp-gis-layer-symbology-container">
        This symbology type is not available; no attributes contain a hex color
        code.
      </div>
    );
  } else {
    return (
      <div className="jp-gis-layer-symbology-container">
        <ValueSelect
          featureProperties={selectableAttributesAndValues}
          selectedValue={selectedValue}
          setSelectedValue={setSelectedValue}
        />
      </div>
    );
  }
};

export default Canonical;
