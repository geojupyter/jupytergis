import { FlatStyle } from 'ol/style/flat';
import React, { useEffect, useRef, useState } from 'react';

import { ISymbologyDialogProps } from '@/src/dialogs/symbology/symbologyDialog';
import { IParsedStyle, parseColor } from '@/src/tools';

const SimpleSymbol = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const styleRef = useRef<IParsedStyle>();

  const [style, setStyle] = useState<IParsedStyle>({
    fillColor: '#3399CC',
    joinStyle: 'round',
    strokeColor: '#3399CC',
    capStyle: 'round',
    strokeWidth: 1.25,
    radius: 5
  });

  const joinStyleOptions = ['bevel', 'round', 'miter'];
  const capStyleOptions = ['butt', 'round', 'square'];

  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);
  if (!layer) {
    return;
  }

  useEffect(() => {
    if (!layer.parameters) {
      return;
    }

    const initStyle = async () => {
      if (!layer.parameters) {
        return;
      }

      const renderType = layer.parameters?.symbologyState.renderType;

      if (renderType === 'Single Symbol') {
        // Parse with fallback logic inside
        const parsedStyle = parseColor(layer.parameters.color);

        if (parsedStyle) {
          setStyle(parsedStyle);
        }
      }
    };
    initStyle();

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
    styleRef.current = style;
  }, [style]);

  const handleOk = () => {
    if (!layer.parameters) {
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
      'stroke-line-cap': styleRef.current?.capStyle
    };

    const symbologyState = {
      renderType: 'Single Symbol'
    };

    layer.parameters.symbologyState = symbologyState;
    layer.parameters.color = styleExpr;
    if (layer.type === 'HeatmapLayer') {
      layer.type = 'VectorLayer';
    }

    model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  return (
    <div className="jp-gis-layer-symbology-container">
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Radius:</label>
        <input
          type="number"
          value={style.radius}
          className="jp-mod-styled"
          onChange={event =>
            setStyle(prevState => ({
              ...prevState,
              radius: +event.target.value
            }))
          }
        />
      </div>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Fill Color:</label>
        <input
          type="color"
          value={style.fillColor}
          className="jp-mod-styled"
          onChange={event =>
            setStyle(prevState => ({
              ...prevState,
              fillColor: event.target.value
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
              strokeColor: event.target.value
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
              strokeWidth: +event.target.value
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
                joinStyle: event.target.value
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
                capStyle: event.target.value
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
    </div>
  );
};

export default SimpleSymbol;
