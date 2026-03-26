import { IVectorLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useState } from 'react';

import RgbaColorPicker from '@/src/dialogs/symbology/components/color_ramp/RgbaColorPicker';
import { colorToRgba, RgbaColor } from '@/src/dialogs/symbology/colorRampUtils';
import { useOkSignal } from '@/src/dialogs/symbology/hooks/useOkSignal';
import { saveSymbology } from '@/src/dialogs/symbology/symbologyUtils';
import ValueSelect from '@/src/dialogs/symbology/vector_layer/components/ValueSelect';
import { useLatest } from '@/src/shared/hooks/useLatest';
import { ISymbologyDialogWithAttributesProps } from '../../symbologyDialog';

const TRANSPARENT: RgbaColor = [0, 0, 0, 0];

const Canonical: React.FC<ISymbologyDialogWithAttributesProps> = ({
  model,
  okSignalPromise,
  layerId,
  selectableAttributesAndValues,
  isStorySegmentOverride,
  segmentId,
}) => {
  const [selectedValue, setSelectedValue] = useState('');
  const [fallbackColor, setFallbackColor] = useState<RgbaColor>(TRANSPARENT);

  const selectedValueRef = useLatest(selectedValue);
  const fallbackColorRef = useLatest(fallbackColor);

  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  useEffect(() => {
    const layerParams = layer.parameters as IVectorLayer;
    const savedValue = layerParams.symbologyState?.value;
    const value =
      savedValue && savedValue in selectableAttributesAndValues
        ? savedValue
        : Object.keys(selectableAttributesAndValues)[0];

    setSelectedValue(value);
    setFallbackColor(
      colorToRgba(layerParams.symbologyState?.fallbackColor ?? TRANSPARENT),
    );
  }, [selectableAttributesAndValues]);

  const handleOk = () => {
    if (!layer.parameters) {
      return;
    }

    // Use coalesce so that features missing the color property (e.g. boundary
    // or line features in a multi-layer MVT) fall back to the user-chosen color
    // instead of returning undefined, which would cause OL to throw at render time.
    const colorExpr: ExpressionValue = [
      'coalesce',
      ['get', selectedValueRef.current],
      fallbackColorRef.current,
    ];
    const newStyle = { ...layer.parameters.color };
    newStyle['fill-color'] = colorExpr;
    newStyle['stroke-color'] = colorExpr;
    newStyle['circle-fill-color'] = colorExpr;

    const symbologyState = {
      renderType: 'Canonical',
      value: selectedValueRef.current,
      fallbackColor: fallbackColorRef.current,
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
      <div className="jp-gis-symbology-row">
        <label>Fallback Color:</label>
        <RgbaColorPicker color={fallbackColor} onChange={setFallbackColor} />
      </div>
    </div>
  );
};

export default Canonical;
