import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useRef } from 'react';

import { IStopRow } from '@/src/dialogs/symbology/symbologyDialog';

type RgbColorValue =
  | [number, number, number]
  | [number, number, number, number];
type HexColorValue = string;
type InternalRgbArray = number[];

type ColorValue = RgbColorValue | HexColorValue;
type SizeValue = number;

export type SymbologyValue = SizeValue | ColorValue | InternalRgbArray;

const StopRow: React.FC<{
  index: number;
  dataValue: number;
  symbologyValue: SymbologyValue;
  stopRows: IStopRow[];
  setStopRows: (stopRows: IStopRow[]) => void;
  deleteRow: () => void;
  useNumber?: boolean;
}> = ({
  index,
  dataValue,
  symbologyValue,
  stopRows,
  setStopRows,
  deleteRow,
  useNumber,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current === document.activeElement) {
      inputRef.current?.focus();
    }
  }, [stopRows]);

  const ensureHexColorCode = (color: number | number[] | string): string => {
    if (typeof color === 'string') {
      return color;
    }
    if (typeof color === 'number') {
      return '#000000';
    }
    if (!Array.isArray(color)) {
      return '#000000'; // Default to black
    }

    const hex = color
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
      1, // TODO: Make alpha customizable?
    ];

    return rgbValues;
  };

  const handleStopChange = (event: { target: { value: string } }) => {
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
        value={dataValue}
        onChange={handleStopChange}
        onBlur={handleBlur}
        className="jp-mod-styled jp-gis-color-row-value-input"
      />

      {useNumber ? (
        <input
          type="number"
          ref={inputRef}
          value={symbologyValue as SizeValue}
          onChange={handleOutputChange}
          className="jp-mod-styled jp-gis-color-row-output-input"
        />
      ) : (
        <input
          id={`jp-gis-color-color-${index}`}
          ref={inputRef}
          value={ensureHexColorCode(symbologyValue as ColorValue)}
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
