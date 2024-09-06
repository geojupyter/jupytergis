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
  const [, setInputZoom] = useState(10);
  const [, setInputColor] = useState('');

  // const rgbaStringToHex = (rgbaStr: any) => {
  //   // Remove the "rgba(" part and close parenthesis
  //   const rgbaParts = rgbaStr.replace('rgba(', '').replace(')', '');

  //   // Split the string into individual components
  //   const [r, g, b, a] = rgbaParts
  //     .split(',')
  //     .map((part: any) => parseInt(part.trim()));

  //   // Convert R, G, B to hexadecimal and ensure they are two digits long
  //   const rHex = r.toString(16).padStart(2, '0');
  //   const gHex = g.toString(16).padStart(2, '0');
  //   const bHex = b.toString(16).padStart(2, '0');

  //   // Optionally handle alpha channel if needed
  //   // For simplicity, this example ignores the alpha channel
  //   // If you need to include alpha, you could append it after the RGB part, e.g., `return '#' + rHex + gHex + bHex + (a === 1 ? '' : a.toString(16));`
  //   return '#' + rHex + gHex + bHex;
  // };

  const rgbArrToHex = (rgbArr: any) => {
    const hex = rgbArr
      .map((val: any) => {
        return val.toString(16).padStart(2, '0');
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('');

    return '#' + hex;
  };

  const hexToRgb = (hex: any) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    const l = result
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16)
        ]
      : null;
    return l;
  };

  const handleValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRows = [...stopRows];
    const value = parseFloat(event.target.value);
    stopRows[index].value = value;
    setStopRows(newRows);
    setInputZoom(value);
  };

  const handleColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
