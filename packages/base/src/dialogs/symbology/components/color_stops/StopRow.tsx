import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useRef } from 'react';

import {
  ensureHexColorCode,
  hexToRgb,
  COLOR_RAMP_DEFINITIONS,
  ColorRampName,
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
  rampName?: string;
}> = ({
  index,
  dataValue,
  symbologyValue,
  stopRows,
  setStopRows,
  deleteRow,
  useNumber,
  rampName,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const ramp = rampName
    ? COLOR_RAMP_DEFINITIONS[rampName as ColorRampName]
    : undefined;
  const isCritical =
    ramp?.type === 'Divergent' && ramp?.criticalValue?.includes(dataValue);

  useEffect(() => {
    if (inputRef.current === document.activeElement) {
      inputRef.current?.focus();
    }
  }, [stopRows]);

  const handleStopChange = (event: { target: { value: string } }) => {
    if (isCritical) {
      return;
    }
    const newRows = [...stopRows];
    newRows[index].stop = +event.target.value;
    setStopRows(newRows);
  };

  const handleBlur = () => {
    if (isCritical) {
      return;
    }
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
    if (isCritical) {
      return;
    }
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
        disabled={isCritical}
        className="jp-mod-styled jp-gis-color-row-value-input"
      />

      {useNumber ? (
        <input
          type="number"
          ref={inputRef}
          value={symbologyValue as SizeValue}
          onChange={handleOutputChange}
          disabled={isCritical}
          className="jp-mod-styled jp-gis-color-row-output-input"
        />
      ) : (
        <input
          id={`jp-gis-color-color-${index}`}
          ref={inputRef}
          value={ensureHexColorCode(symbologyValue as ColorValue)}
          type="color"
          onChange={handleOutputChange}
          disabled={isCritical}
          className="jp-mod-styled jp-gis-color-row-output-input"
        />
      )}

      {!isCritical && (
        <Button
          id={`jp-gis-remove-color-${index}`}
          className="jp-Button jp-gis-filter-icon"
        >
          <FontAwesomeIcon icon={faTrash} onClick={deleteRow} />
        </Button>
      )}
      {/* Critical label */}
      {isCritical && <span className="text-xs text-gray-500">(critical)</span>}
    </div>
  );
};

export default StopRow;
