import { IVectorLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useState } from 'react';

import { useOkSignal } from '@/src/dialogs/symbology/hooks/useOkSignal';
import { saveSymbology } from '@/src/dialogs/symbology/symbologyUtils';
import ValueSelect from '@/src/dialogs/symbology/vector_layer/components/ValueSelect';
import { useLatest } from '@/src/shared/hooks/useLatest';
import { ISymbologyDialogWithAttributesProps } from '../../symbologyDialog';

const Canonical: React.FC<ISymbologyDialogWithAttributesProps> = ({
  model,
  okSignalPromise,
  layerId,
  selectableAttributesAndValues,
  isStorySegmentOverride,
  segmentId,
}) => {
  const [selectedValue, setSelectedValue] = useState('');
  const selectedValueRef = useLatest(selectedValue);

  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  useEffect(() => {
    const layerParams = layer.parameters as IVectorLayer;
    const value =
      layerParams.symbologyState?.value ??
      Object.keys(selectableAttributesAndValues)[0];

    setSelectedValue(value);
  }, [selectableAttributesAndValues]);

  const handleOk = () => {
    if (!layer.parameters) {
      return;
    }

    const colorExpr: ExpressionValue[] = ['get', selectedValueRef.current];
    const newStyle = { ...layer.parameters.color };
    newStyle['fill-color'] = colorExpr;
    newStyle['stroke-color'] = colorExpr;
    newStyle['circle-fill-color'] = colorExpr;

    const symbologyState = {
      renderType: 'Canonical',
      value: selectedValueRef.current,
    };

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

  return (
    <div className="jp-gis-layer-symbology-container">
      <p>Color features based on an attribute containing a hex color code.</p>
      {body}
    </div>
  );
};

export default Canonical;
