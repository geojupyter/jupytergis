import { FlatStyle } from 'ol/style/flat';
import React, { useEffect, useRef, useState } from 'react';
import { IParsedStyle, parseColor } from '../../../../tools';
import { ISymbologyDialogProps } from '../../symbologyDialog';

const SimpleSymbol = ({
  context,
  state,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const styleRef = useRef<IParsedStyle>();

  const [useCircleStuff, setUseCircleStuff] = useState(false);
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
  const layer = context.model.getLayer(layerId);
  if (!layer) {
    return;
  }

  useEffect(() => {
    if (!layer.parameters) {
      return;
    }

    setUseCircleStuff(layer.parameters.type === 'circle');

    // Mimicking QGIS here,
    // Read values from file if we chose them using the single symbol thing
    // but if we're switching to simple symbol, use defaults
    const initStyle = async () => {
      if (!layer.parameters) {
        return;
      }
      const renderType = layer.parameters?.symbologyState.renderType;

      if (renderType === 'Single Symbol') {
        // Read from current color or use defaults
        const parsedStyle = parseColor(
          layer.parameters.type,
          layer.parameters.color
        );

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

    const styleExpr: FlatStyle = {};

    const prefix = layer.parameters.type === 'circle' ? 'circle-' : '';

    if (layer.parameters.type === 'circle') {
      styleExpr['circle-radius'] = styleRef.current?.radius;
    }

    styleExpr[`${prefix}fill-color`] = styleRef.current?.fillColor;
    styleExpr[`${prefix}stroke-color`] = styleRef.current?.strokeColor;
    styleExpr[`${prefix}stroke-width`] = styleRef.current?.strokeWidth;
    styleExpr[`${prefix}stroke-line-join`] = styleRef.current?.joinStyle;
    styleExpr[`${prefix}stroke-line-cap`] = styleRef.current?.capStyle;

    const symbologyState = {
      renderType: 'Single Symbol'
    };

    layer.parameters.symbologyState = symbologyState;
    layer.parameters.color = styleExpr;

    context.model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  return (
    <div className="jp-gis-layer-symbology-container">
      {useCircleStuff ? (
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
      ) : null}
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
          >
            {joinStyleOptions.map((method, index) => (
              <option
                key={index}
                value={method}
                selected={method === style.joinStyle}
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
                setStyle(prevState => ({
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
                  selected={cap === style.capStyle}
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
