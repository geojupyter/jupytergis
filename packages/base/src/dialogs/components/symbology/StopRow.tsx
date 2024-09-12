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
  setStopRows,
  deleteRow
}: {
  index: number;
  value: number;
  outputValue: number[];
  stopRows: IStopRow[];
  setStopRows: (stopRows: IStopRow[]) => void;
  deleteRow: () => void;
}) => {
  const rgbArrToHex = (rgbArr: number[]) => {
    const hex = rgbArr
      .slice(0, -1) // Color input doesn't support hex alpha values so cut that out
      .map((val: { toString: (arg0: number) => string }) => {
        return val.toString(16).padStart(2, '0');
      })
      .join('');

    return '#' + hex;
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    if (!result) {
      console.warn('Unable to parse hex value, defaulting to black');
      return [parseInt('0', 16), parseInt('0', 16), parseInt('0', 16)];
    }
    const rgbValues = [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
      1 // TODO: Make alpha customizable?
    ];

    return rgbValues;
  };

  const handleValueChange = (event: { target: { value: string | number } }) => {
    const newRows = [...stopRows];
    newRows[index].value = +event.target.value;
    setStopRows(newRows);
  };

  const handleBlur = () => {
    const newRows = [...stopRows];
    newRows.sort((a, b) => {
      if (a.value < b.value) {
        return -1;
      }
      if (a.value > b.value) {
        return 1;
      }
      return 0;
    });
    setStopRows(newRows);
  };

  const handleColorChange = (event: { target: { value: any } }) => {
    const newRows = [...stopRows];
    newRows[index].color = hexToRgb(event.target.value);
    setStopRows(newRows);
  };

  return (
    <div className="jp-gis-color-row">
      <input
        id={`jp-gis-color-value-${index}`}
        type="number"
        value={value}
        onChange={handleValueChange}
        onBlur={handleBlur}
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
        <FontAwesomeIcon icon={faTrash} onClick={deleteRow} />
      </Button>
    </div>
  );
};

export default StopRow;
