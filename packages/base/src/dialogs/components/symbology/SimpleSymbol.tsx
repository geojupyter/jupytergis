import { FlatStyle } from 'ol/style/flat';
import React, { useEffect, useRef, useState } from 'react';
import { IParsedStyle, parseColor } from '../../../tools';
import { ISymbologyDialogProps } from '../../symbologyDialog';

const SimpleSymbol = ({
  context,
  state,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const parsedStyleRef = useRef<IParsedStyle>();

  const [useCircleStuff, setUseCircleStuff] = useState(false);

  const [parsedStyle, setParsedStyle] = useState<IParsedStyle>({
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
  const layer = context.model.getLayer(layerId);
  if (!layer) {
    return;
  }

  useEffect(() => {
    if (!layer.parameters) {
      return;
    }

    setUseCircleStuff(layer.parameters.type === 'circle');

    // Read from current color or use defaults
    const style = parseColor(layer.parameters.type, layer.parameters.color);

    if (style) {
      setParsedStyle(style);
    }

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
    parsedStyleRef.current = parsedStyle;
  }, [parsedStyle]);

  const handleOk = () => {
    if (!layer.parameters) {
      return;
    }

    const styleExpr: FlatStyle = {};

    const prefix = layer.parameters.type === 'circle' ? 'circle-' : '';

    if (layer.parameters.type === 'circle') {
      styleExpr['circle-radius'] = parsedStyleRef.current?.radius;
    }

    styleExpr[`${prefix}fill-color`] = parsedStyleRef.current?.fillColor;
    styleExpr[`${prefix}stroke-color`] = parsedStyleRef.current?.strokeColor;
    styleExpr[`${prefix}stroke-width`] = parsedStyleRef.current?.strokeWidth;
    styleExpr[`${prefix}stroke-line-join`] = parsedStyleRef.current?.joinStyle;
    styleExpr[`${prefix}stroke-line-cap`] = parsedStyleRef.current?.capStyle;

    layer.parameters.color = styleExpr;

    context.model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {useCircleStuff ? (
        <div className="jp-gis-symbology-row">
          <label htmlFor={'vector-value-select'}>Radius:</label>
          <input
            type="number"
            value={parsedStyle.radius}
            className="jp-mod-styled"
            onChange={event =>
              setParsedStyle(prevState => ({
                ...prevState,
                radius: +event.target.value
              }))
            }
          />
        </div>
      ) : null}
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Fill Color:</label>
        <input
          type="color"
          value={parsedStyle.fillColor}
          className="jp-mod-styled"
          onChange={event =>
            setParsedStyle(prevState => ({
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
          value={parsedStyle.strokeColor}
          className="jp-mod-styled"
          onChange={event =>
            setParsedStyle(prevState => ({
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
          value={parsedStyle.strokeWidth}
          className="jp-mod-styled"
          onChange={event =>
            setParsedStyle(prevState => ({
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
              setParsedStyle(prevState => ({
                ...prevState,
                joinStyle: event.target.value
              }))
            }
            className="jp-mod-styled"
          >
            {joinStyleOptions.map((method, index) => (
              <option
                key={index}
                value={method}
                selected={method === parsedStyle.joinStyle}
                className="jp-mod-styled"
              >
                {method}
              </option>
            ))}
          </select>
        </div>
      </div>
      {useCircleStuff ? (
        <div className="jp-gis-symbology-row">
          <label htmlFor={'vector-cap-select'}>Cap Style:</label>
          <div className="jp-select-wrapper">
            <select
              name={'vector-cap-select'}
              onChange={event =>
                setParsedStyle(prevState => ({
                  ...prevState,
                  capStyle: event.target.value
                }))
              }
              className="jp-mod-styled"
            >
              {capStyleOptions.map((cap, index) => (
                <option
                  key={index}
                  value={cap}
                  selected={cap === parsedStyle.capStyle}
                  className="jp-mod-styled"
                >
                  {cap}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SimpleSymbol;
