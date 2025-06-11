import { IVectorLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';

import ValueSelect from '@/src/dialogs/symbology/vector_layer/components/ValueSelect';
import { ISymbologyDialogWithAttributesProps } from '../../symbologyDialog';

const Canonical = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId,
  selectableAttributesAndValues,
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
      layerParams.symbologyState?.value ??
      Object.keys(selectableAttributesAndValues)[0];

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

  const body = (() => {
    if (Object.keys(selectableAttributesAndValues)?.length === 0) {
      return (
        <p className="errors">
          This symbology type is not available; no attributes contain a hex
          color code.
        </p>
      );
    } else {
      return (
        <ValueSelect
          featureProperties={selectableAttributesAndValues}
          selectedValue={selectedValue}
          setSelectedValue={setSelectedValue}
        />
      );
    }
  })();

  return <div className="jp-gis-layer-symbology-container">{body}</div>;
};

export default Canonical;
