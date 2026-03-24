import { FlatStyle } from 'ol/style/flat';
import React, { useEffect, useState } from 'react';

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
    strokeWidth: 1.25,
    radius: 5,
  });
  const styleRef = useLatest(style);

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
    }
  }, [params]);

  const handleOk = () => {
    if (!layerId || !layer?.parameters) {
      return;
    }

    const styleExpr: FlatStyle = {
      'circle-radius': styleRef.current?.radius,
      'circle-fill-color': styleRef.current?.fillColor,
      'circle-stroke-color': styleRef.current?.strokeColor,
      'circle-stroke-width': styleRef.current?.strokeWidth,
      'circle-stroke-line-join': styleRef.current?.joinStyle,
      'circle-stroke-line-cap': styleRef.current?.capStyle,
      'fill-color': styleRef.current?.fillColor,
      'stroke-color': styleRef.current?.strokeColor,
      'stroke-width': styleRef.current?.strokeWidth,
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
        <input
          type="color"
          value={style.fillColor}
          className="jp-mod-styled"
          onChange={event =>
            setStyle(prevState => ({
              ...prevState,
              fillColor: event.target.value,
            }))
          }
        />
      </div>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Stroke Color:</label>
        <input
          type="color"
          value={style.strokeColor}
          className="jp-mod-styled"
          onChange={event =>
            setStyle(prevState => ({
              ...prevState,
              strokeColor: event.target.value,
            }))
          }
        />
      </div>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Stroke Width:</label>
        <input
          type="number"
          value={style.strokeWidth}
          className="jp-mod-styled"
          onChange={event =>
            setStyle(prevState => ({
              ...prevState,
              strokeWidth: +event.target.value,
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
