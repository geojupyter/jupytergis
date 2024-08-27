import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from '@jupyterlab/ui-components';
import React, { useState } from 'react';
import { IStopRow } from '../../colorExpressionDialog';

const StopRow = ({
  index,
  value,
  outputValue,
  stopRows,
  setStopRows
}: {
  index: number;
  value: number;
  outputValue: string;
  stopRows: IStopRow[];
  setStopRows: any;
}) => {
  const [inputZoom, setInputZoom] = useState(10);
  const [inputColor, setInputColor] = useState('');

  const rgbaStringToHex = rgbaStr => {
    // Remove the "rgba(" part and close parenthesis
    const rgbaParts = rgbaStr.replace('rgba(', '').replace(')', '');

    // Split the string into individual components
    const [r, g, b, a] = rgbaParts
      .split(',')
      .map(part => parseInt(part.trim()));

    // Convert R, G, B to hexadecimal and ensure they are two digits long
    const rHex = r.toString(16).padStart(2, '0');
    const gHex = g.toString(16).padStart(2, '0');
    const bHex = b.toString(16).padStart(2, '0');

    // Optionally handle alpha channel if needed
    // For simplicity, this example ignores the alpha channel
    // If you need to include alpha, you could append it after the RGB part, e.g., `return '#' + rHex + gHex + bHex + (a === 1 ? '' : a.toString(16));`
    console.log('rHex + gHex + bHex', '#' + rHex + gHex + bHex);
    return '#' + rHex + gHex + bHex;
  };

  const rgbArrToHex = rgbArr => {
    const hex = rgbArr
      .map(val => {
        return val.toString(16).padStart(2, '0');
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('');

    console.log('hex', hex);
    return '#' + hex;
  };

  const hexToRgb = hex => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    const l = result
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16)
        ]
      : null;
    console.log('result', l);
    return l;
  };

  const handleValueChange = event => {
    const newRows = [...stopRows];
    stopRows[index].value = event.target.value;
    setStopRows(newRows);
    setInputZoom(event.target.value);
  };

  const handleColorChange = event => {
    const newRows = [...stopRows];
    stopRows[index].color = hexToRgb(event.target.value);
    setStopRows(newRows);
    setInputColor(event.target.value);
  };

  return (
    <div className="jp-gis-color-row">
      <input
        id={`jp-gis-color-value-${index}`}
        type="number"
        defaultValue={value}
        onChange={handleValueChange}
      />
      <input
        id={`jp-gis-color-color-${index}`}
        value={rgbArrToHex(outputValue)}
        type="color"
        onChange={handleColorChange}
      />
      <Button
        id={`jp-gis-remove-color-${index}`}
        className="jp-Button jp-gis-filter-icon"
      >
        <FontAwesomeIcon icon={faTrash} />
      </Button>
    </div>
  );
};

export default StopRow;
