import React, { useEffect, useRef, useState } from 'react';
import { ISymbologyDialogProps } from '../../symbologyDialog';

const SingleSymbol = ({
  context,
  state,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const fillColorRef = useRef<string>();
  const strokeColorRef = useRef<string>();
  const strokeWidthRef = useRef<string>();
  const [fillColor, setFillColor] = useState('');
  const [strokeColor, setStrokeColor] = useState('');
  const [strokeWidth, setStrokeWidth] = useState('');
  const [joinStyle, setJoinStyle] = useState('bevel');

  const joinStyleOptions = ['bevel', 'round', 'miter'];

  if (!layerId) {
    return;
  }
  const layer = context.model.getLayer(layerId);
  if (!layer) {
    return;
  }

  useEffect(() => {
    // Read from current color or use defaults

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
    fillColorRef.current = fillColor;
    strokeColorRef.current = strokeColor;
    strokeWidthRef.current = strokeWidth;
  }, [fillColor, strokeColor, strokeWidth]);

  const handleOk = () => {
    if (!layer.parameters) {
      return;
    }

    const styleExpr = {};

    if (layer.parameters.type === 'circle') {
      styleExpr['circle-fill-color'] = fillColorRef.current;
      styleExpr['circle-stroke-color'] = strokeColorRef.current;
      styleExpr['circle-stroke-width'] = strokeWidthRef.current;
    } else {
      styleExpr['fill-color'] = fillColorRef.current;
      styleExpr['stroke-color'] = strokeColorRef.current;
      styleExpr['stroke-width'] = strokeWidthRef.current;
    }

    layer.parameters.color = styleExpr;

    context.model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Fill Color:</label>
        <input
          type="color"
          className="jp-mod-styled"
          onChange={event => setFillColor(event?.target.value)}
        />
      </div>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Stroke Color:</label>
        <input
          type="color"
          className="jp-mod-styled"
          onChange={event => setStrokeColor(event.target.value)}
        />
      </div>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Stroke Width:</label>
        <input
          type="number"
          className="jp-mod-styled"
          onChange={event => setStrokeWidth(event.target.value)}
        />
      </div>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-method-select'}>Join Style:</label>
        <div className="jp-select-wrapper">
          <select
            name={'vector-method-select'}
            onChange={event => setJoinStyle(event.target.value)}
            className="jp-mod-styled"
          >
            {joinStyleOptions.map((method, index) => (
              <option
                key={index}
                value={method}
                selected={method === joinStyle}
                className="jp-mod-styled"
              >
                {method}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default SingleSymbol;
