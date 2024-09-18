import React, { useEffect, useRef, useState } from 'react';
import { IParsedStyle, parseColor } from '../../../tools';
import { ISymbologyDialogProps } from '../../symbologyDialog';

// interface IParsedStyle {
//   fillColor: string;
//   stokeColor: string;
//   strokeWidth: number;
//   joinStyle: string;
//   capStyle?: string;
//   radius?: number;
// }

// type IParsedStyle = ReturnType<typeof parseColor>;
const SingleSymbol = ({
  context,
  state,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  // const radiusRef = useRef<number>();
  // const fillColorRef = useRef<string>();
  // const strokeColorRef = useRef<string>();
  // const strokeWidthRef = useRef<number>();
  // const joinStyleRef = useRef<string>();
  // const capStyleRef = useRef<string>();
  const parsedStyleRef = useRef<IParsedStyle>();

  // const [radius, setRadius] = useState<number>();
  // const [fillColor, setFillColor] = useState<string>();
  // const [strokeColor, setStrokeColor] = useState<string>();
  // const [strokeWidth, setStrokeWidth] = useState<number>();
  // const [joinStyle, setJoinStyle] = useState<string>();
  // const [capStyle, setCapStyle] = useState<string>();
  const [useCircleStuff, setUseCircleStuff] = useState(false);

  const [parsedStyle, setParsedStyle] = useState<IParsedStyle>({
    fillColor: '',
    joinStyle: '',
    strokeColor: '',
    capStyle: '',
    strokeWidth: 0,
    radius: 0
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
    if (!layer.parameters?.color) {
      return;
    }

    setUseCircleStuff(layer.parameters.type === 'circle');

    // const color = layer.parameters.color;

    // Read from current color or use defaults
    const style = parseColor(layer.parameters.type, layer.parameters.color);

    console.log('style', style);
    setParsedStyle(style);
    // if (layer.parameters.type === 'circle') {
    //   setRadius(color['circle-radius'] ? color['circle-radius'] : 5);
    //   setFillColor(
    //     color['circle-fill-color']
    //       ? color['circle-fill-color']
    //       : '[255, 255, 255, 0.4]'
    //   );
    //   setStrokeColor(
    //     color['circle-stroke-color'] ? color['circle-stroke-color'] : '#3399CC'
    //   );
    //   setStrokeWidth(
    //     color['circle-stroke-width'] ? color['circle-stroke-width'] : 1.25
    //   );
    //   setJoinStyle(
    //     color['circle-stroke-line-join']
    //       ? color['circle-stroke-line-join']
    //       : 'round'
    //   );
    //   setCapStyle(
    //     color['circle-stroke-line-cap']
    //       ? color['circle-stroke-line-cap']
    //       : 'round'
    //   );
    // } else {
    //   setFillColor(
    //     color['fill-color'] ? color['fill-color'] : '[255, 255, 255, 0.4]'
    //   );
    //   setStrokeColor(color['stroke-color'] ? color['stroke-color'] : '#3399CC');
    //   setStrokeWidth(color['stroke-width'] ? color['stroke-width'] : 1.25);
    //   setJoinStyle(
    //     color['stroke-line-join'] ? color['stroke-line-join'] : 'round'
    //   );
    // }

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
    // radiusRef.current = radius;
    // fillColorRef.current = fillColor;
    // strokeColorRef.current = strokeColor;
    // strokeWidthRef.current = strokeWidth;
    // joinStyleRef.current = joinStyle;
    // capStyleRef.current = capStyle;
    parsedStyleRef.current = parsedStyle;
  }, [
    // radius,
    // fillColor,
    // strokeColor,
    // strokeWidth,
    // joinStyle,
    // capStyle,
    parsedStyle
  ]);

  const handleOk = () => {
    if (!layer.parameters) {
      return;
    }

    const styleExpr: any = {};

    // if (layer.parameters.type === 'circle') {
    //   styleExpr['circle-radius'] = radiusRef.current;
    //   styleExpr['circle-fill-color'] = fillColorRef.current;
    //   styleExpr['circle-stroke-color'] = strokeColorRef.current;
    //   styleExpr['circle-stroke-width'] = strokeWidthRef.current;
    //   styleExpr['circle-stroke-line-join'] = joinStyleRef.current;
    // } else {
    //   styleExpr['fill-color'] = fillColorRef.current;
    //   styleExpr['stroke-color'] = strokeColorRef.current;
    //   styleExpr['stroke-width'] = strokeWidthRef.current;
    //   styleExpr['stroke-line-join'] = joinStyleRef.current;
    // }

    let prefix = '';
    if (layer.parameters.type === 'circle') {
      prefix = 'circle-';
    }

    const c = 'circle-stroke-color';

    styleExpr['circle-radius'] = parsedStyleRef.current?.radius;
    styleExpr[`${prefix}fill-color`] = parsedStyleRef.current?.fillColor;
    styleExpr[c] = parsedStyleRef.current?.strokeColor;
    styleExpr['circle-stroke-width'] = parsedStyleRef.current?.strokeWidth;
    styleExpr['circle-stroke-line-join'] = parsedStyleRef.current?.joinStyle;

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
              stokeColor: event.target.value
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

export default SingleSymbol;
