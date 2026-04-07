import { IVectorLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useState } from 'react';

import {
  colorToRgba,
  DEFAULT_COLOR,
  DEFAULT_STROKE_WIDTH,
  isColor,
  RgbaColor,
} from '@/src/features/layers/symbology/colorRampUtils';
import RgbaColorPicker from '@/src/features/layers/symbology/components/color_ramp/RgbaColorPicker';
import { useOkSignal } from '@/src/features/layers/symbology/hooks/useOkSignal';
import { saveSymbology } from '@/src/features/layers/symbology/symbologyUtils';
import ValueSelect from '@/src/features/layers/symbology/vector_layer/components/ValueSelect';
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
  const [strokeFollowsFill, setStrokeFollowsFill] = useState(true);
  const [strokeColor, setStrokeColor] = useState<RgbaColor>(DEFAULT_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(String(DEFAULT_STROKE_WIDTH));

  const selectedValueRef = useLatest(selectedValue);
  const fallbackColorRef = useLatest(fallbackColor);
  const strokeFollowsFillRef = useLatest(strokeFollowsFill);
  const strokeColorRef = useLatest(strokeColor);
  const strokeWidthRef = useLatest(strokeWidth);

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
    setStrokeFollowsFill(layerParams.symbologyState?.strokeFollowsFill ?? true);

    const savedStroke = layerParams.color?.['stroke-color'];
    setStrokeColor(
      isColor(savedStroke) ? colorToRgba(savedStroke) : DEFAULT_COLOR,
    );
    setStrokeWidth(
      String(layerParams.color?.['stroke-width'] ?? DEFAULT_STROKE_WIDTH),
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
    newStyle['circle-fill-color'] = colorExpr;

    if (strokeFollowsFillRef.current) {
      newStyle['stroke-color'] = colorExpr;
      newStyle['circle-stroke-color'] = colorExpr;
    } else {
      newStyle['stroke-color'] = strokeColorRef.current;
      newStyle['circle-stroke-color'] = strokeColorRef.current;
      newStyle['stroke-width'] = Math.max(
        0,
        parseFloat(strokeWidthRef.current),
      );
      newStyle['circle-stroke-width'] = Math.max(
        0,
        parseFloat(strokeWidthRef.current),
      );
    }

    const symbologyState = {
      renderType: 'Canonical',
      value: selectedValueRef.current,
      fallbackColor: fallbackColorRef.current,
      strokeFollowsFill: strokeFollowsFillRef.current,
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
        <label>Stroke Color:</label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: '1 0 50%',
            maxWidth: '50%',
          }}
        >
          <div
            style={{
              opacity: strokeFollowsFill ? 0.3 : 1,
              pointerEvents: strokeFollowsFill ? 'none' : 'auto',
            }}
          >
            <RgbaColorPicker color={strokeColor} onChange={setStrokeColor} />
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
            }}
          >
            <input
              type="checkbox"
              checked={strokeFollowsFill}
              onChange={e => setStrokeFollowsFill(e.target.checked)}
            />
            match fill
          </label>
        </div>
      </div>
      <div className="jp-gis-symbology-row">
        <label>Stroke Width:</label>
        <input
          type="text"
          className="jp-mod-styled"
          value={strokeWidth}
          onChange={e => setStrokeWidth(e.target.value)}
        />
      </div>
      <div className="jp-gis-symbology-row">
        <label>Fallback Color:</label>
        <RgbaColorPicker color={fallbackColor} onChange={setFallbackColor} />
      </div>
    </div>
  );
};

export default Canonical;
