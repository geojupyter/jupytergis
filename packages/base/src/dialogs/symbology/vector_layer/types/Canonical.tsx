import { IVectorLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';

import { useGetProperties } from '@/src/dialogs/symbology/hooks/useGetProperties';
import { ISymbologyDialogProps } from '@/src/dialogs/symbology/symbologyDialog';
import ValueSelect from '@/src/dialogs/symbology/vector_layer/components/ValueSelect';
import { getColorCodeFeatureAttributes } from '@/src/tools';

const Canonical = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId,
  selectableAttributes
}: ISymbologyDialogProps) => {
  const selectedValueRef = useRef<string>();

  const [selectedValue, setSelectedValue] = useState('');
  const [attributes, setAttributes] = useState<Record<string, Set<string>>>({});

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
    // Filter for hex color code attributes
    const hexAttributes = getColorCodeFeatureAttributes(featureProperties);

    setAttributes(hexAttributes);

    const layerParams = layer.parameters as IVectorLayer;
    const value =
      layerParams.symbologyState?.value ?? Object.keys(hexAttributes)[0];

    setSelectedValue(value);
  }, [featureProperties]);

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
  if (selectableAttributes?.length === 0) {
    return (
      <div className="jp-gis-layer-symbology-container">
        This symbology type is not available; no attributes contain a hex color code.
      </div>
    );
  } else {
    return (
      <div className="jp-gis-layer-symbology-container">
        <ValueSelect
          featureProperties={attributes}
          selectedValue={selectedValue}
          setSelectedValue={setSelectedValue}
        />
      </div>
    );
  }
};

export default Canonical;
