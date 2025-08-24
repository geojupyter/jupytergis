import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useRef } from 'react';

import {
  ensureHexColorCode,
  hexToRgb,
} from '@/src/dialogs/symbology/colorRampUtils';
import { IStopRow } from '@/src/dialogs/symbology/symbologyDialog';
import { SymbologyValue, SizeValue, ColorValue } from '@/src/types';

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
