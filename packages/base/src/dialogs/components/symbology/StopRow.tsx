import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from '@jupyterlab/ui-components';
import React from 'react';
import { IStopRow } from './SingleBandPseudoColor';

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
  const rgbArrToHex = rgbArr => {
    const hex = rgbArr
      .map(val => {
        return val.toString(16).padStart(2, '0');
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('');

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
    return l;
  };

  const handleValueChange = event => {
    const newRows = [...stopRows];
    stopRows[index].value = +event.target.value;
    setStopRows(newRows);
  };

  const handleColorChange = event => {
    const newRows = [...stopRows];
    stopRows[index].color = hexToRgb(event.target.value);
    setStopRows(newRows);
  };

  return (
    <div className="jp-gis-color-row">
      <input
        id={`jp-gis-color-value-${index}`}
        type="number"
        defaultValue={value}
        onChange={handleValueChange}
        className="jp-mod-styled"
      />
      <input
        id={`jp-gis-color-color-${index}`}
        value={rgbArrToHex(outputValue)}
        type="color"
        onChange={handleColorChange}
        className="jp-mod-styled"
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
