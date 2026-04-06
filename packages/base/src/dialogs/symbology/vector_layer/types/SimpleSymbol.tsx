import { FlatStyle } from 'ol/style/flat';
import React, { useEffect, useState } from 'react';

import {
  colorToRgba,
  DEFAULT_COLOR,
  DEFAULT_STROKE_WIDTH,
  RgbaColor,
} from '@/src/dialogs/symbology/colorRampUtils';
import RgbaColorPicker from '@/src/dialogs/symbology/components/color_ramp/RgbaColorPicker';
import { useEffectiveSymbologyParams } from '@/src/dialogs/symbology/hooks/useEffectiveSymbologyParams';
import { useOkSignal } from '@/src/dialogs/symbology/hooks/useOkSignal';
import { ISymbologyTabbedDialogProps } from '@/src/dialogs/symbology/symbologyDialog';
import {
  saveSymbology,
  VectorSymbologyParams,
} from '@/src/dialogs/symbology/symbologyUtils';
import { useLatest } from '@/src/shared/hooks/useLatest';
import { IParsedStyle, parseColor } from '@/src/tools';

const SimpleSymbol: React.FC<ISymbologyTabbedDialogProps> = ({
  model,
  okSignalPromise,
  layerId,
  symbologyTab,
  isStorySegmentOverride,
  segmentId,
}) => {
  const [style, setStyle] = useState<IParsedStyle>({
    fillColor: '#3399CC',
    joinStyle: 'round',
    strokeColor: '#3399CC',
    capStyle: 'round',
    strokeWidth: String(DEFAULT_STROKE_WIDTH),
    radius: 5,
  });
  const styleRef = useLatest(style);
  const [fillRgba, setFillRgba] = useState<RgbaColor>(DEFAULT_COLOR);
  const [strokeRgba, setStrokeRgba] = useState<RgbaColor>(DEFAULT_COLOR);
  const fillRgbaRef = useLatest(fillRgba);
  const strokeRgbaRef = useLatest(strokeRgba);

  const layer = layerId !== undefined ? model.getLayer(layerId) : null;
  const params = useEffectiveSymbologyParams<VectorSymbologyParams>({
    model,
    layerId: layerId,
    layer,
    isStorySegmentOverride,
    segmentId,
  });

  useEffect(() => {
    if (!params) {
      return;
    }
    if (params.symbologyState?.renderType === 'Single Symbol' && params.color) {
      const parsed = parseColor(params.color);
      if (parsed) {
        setStyle(parsed);
      }
      const fillColor =
        params.color['circle-fill-color'] ?? params.color['fill-color'];
      const strokeColor =
        params.color['circle-stroke-color'] ?? params.color['stroke-color'];
      if (fillColor !== undefined) {
        setFillRgba(colorToRgba(fillColor));
      }
      if (strokeColor !== undefined) {
        setStrokeRgba(colorToRgba(strokeColor));
      }
    }
  }, [params]);

  const handleOk = () => {
    if (!layerId || !layer?.parameters) {
      return;
    }

    const styleExpr: FlatStyle = {
      'circle-radius': styleRef.current?.radius,
      'circle-fill-color': fillRgbaRef.current as number[],
      'circle-stroke-color': strokeRgbaRef.current as number[],
      'circle-stroke-width': Math.max(
        0,
        parseFloat(styleRef.current?.strokeWidth ?? '0'),
      ),
      'circle-stroke-line-join': styleRef.current?.joinStyle,
      'circle-stroke-line-cap': styleRef.current?.capStyle,
      'fill-color': fillRgbaRef.current as number[],
      'stroke-color': strokeRgbaRef.current as number[],
      'stroke-width': Math.max(
        0,
        parseFloat(styleRef.current?.strokeWidth ?? '0'),
      ),
      'stroke-line-join': styleRef.current?.joinStyle,
      'stroke-line-cap': styleRef.current?.capStyle,
    };

    const symbologyState = {
      renderType: 'Single Symbol',
    };

    saveSymbology({
      model,
      layerId,
      isStorySegmentOverride,
      segmentId,
      payload: {
        symbologyState,
        color: styleExpr,
      },
      mutateLayerBeforeSave: targetLayer => {
        if (targetLayer.type === 'HeatmapLayer') {
          targetLayer.type = 'VectorLayer';
        }
      },
    });
  };

  useOkSignal(okSignalPromise, handleOk);

  const joinStyleOptions = ['bevel', 'round', 'miter'];
  const capStyleOptions = ['butt', 'round', 'square'];

  if (!layerId || !layer) {
    return null;
  }

  const renderColorTab = () => (
    <>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Fill Color:</label>
        <RgbaColorPicker color={fillRgba} onChange={setFillRgba} />
      </div>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Stroke Color:</label>
        <RgbaColorPicker color={strokeRgba} onChange={setStrokeRgba} />
      </div>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Stroke Width:</label>
        <input
          type="text"
          value={style.strokeWidth}
          className="jp-mod-styled"
          onChange={event =>
            setStyle(prevState => ({
              ...prevState,
              strokeWidth: event.target.value,
            }))
          }
        />
      </div>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-join-select'}>Join Style:</label>
        <div className="jp-select-wrapper">
          <select
            name={'vector-join-select'}
            onChange={event =>
              setStyle(prevState => ({
                ...prevState,
                joinStyle: event.target.value,
              }))
            }
            className="jp-mod-styled"
            value={style.joinStyle}
          >
            {joinStyleOptions.map((method, index) => (
              <option key={index} value={method} className="jp-mod-styled">
                {method}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-cap-select'}>Cap Style:</label>
        <div className="jp-select-wrapper">
          <select
            name={'vector-cap-select'}
            onChange={event =>
              setStyle(prevState => ({
                ...prevState,
                capStyle: event.target.value,
              }))
            }
            className="jp-mod-styled"
            value={style.capStyle}
          >
            {capStyleOptions.map((cap, index) => (
              <option key={index} value={cap} className="jp-mod-styled">
                {cap}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );

  const renderRadiusTab = () => (
    <div className="jp-gis-symbology-row">
      <label>Radius:</label>
      <input
        type="number"
        value={style.radius}
        className="jp-mod-styled"
        onChange={e => setStyle(prev => ({ ...prev, radius: +e.target.value }))}
      />
    </div>
  );

  return (
    <div className="jp-gis-layer-symbology-container">
      <p>Color all features the same way.</p>
      {symbologyTab === 'color' ? renderColorTab() : renderRadiusTab()}
    </div>
  );
};

export default SimpleSymbol;
