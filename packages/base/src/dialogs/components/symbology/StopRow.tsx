import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from '@jupyterlab/ui-components';
import React from 'react';
import { IStopRow } from '../../symbologyDialog';

const StopRow = ({
  index,
  value,
  outputValue,
  stopRows,
  setStopRows,
  deleteRow,
  useNumber
}: {
  index: number;
  value: number;
  outputValue: number | number[];
  stopRows: IStopRow[];
  setStopRows: (stopRows: IStopRow[]) => void;
  deleteRow: () => void;
  useNumber?: boolean;
}) => {
  const rgbArrToHex = (rgbArr: number | number[]) => {
    if (!Array.isArray(rgbArr)) {
      return;
    }

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

  const handleStopChange = (event: { target: { value: string | number } }) => {
    const newRows = [...stopRows];
    newRows[index].stop = +event.target.value;
    setStopRows(newRows);
  };

  const handleBlur = () => {
    const newRows = [...stopRows];
    newRows.sort((a, b) => {
      if (a.stop < b.stop) {
        return -1;
      }
      if (a.stop > b.stop) {
        return 1;
      }
      return 0;
    });
    setStopRows(newRows);
  };

  const handleOutputChange = (event: { target: { value: any } }) => {
    const newRows = [...stopRows];
    useNumber
      ? (newRows[index].output = +event.target.value)
      : (newRows[index].output = hexToRgb(event.target.value));
    setStopRows(newRows);
  };

  return (
    <div className="jp-gis-color-row">
      <input
        id={`jp-gis-color-value-${index}`}
        type="number"
        value={value}
        onChange={handleStopChange}
        onBlur={handleBlur}
        className="jp-mod-styled jp-gis-color-row-value-input"
      />

      {useNumber ? (
        <input
          type="number"
          value={outputValue as number}
          onChange={handleOutputChange}
          className="jp-mod-styled jp-gis-color-row-output-input"
        />
      ) : (
        <input
          id={`jp-gis-color-color-${index}`}
          value={rgbArrToHex(outputValue)}
          type="color"
          onChange={handleOutputChange}
          className="jp-mod-styled jp-gis-color-row-output-input"
        />
      )}

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
