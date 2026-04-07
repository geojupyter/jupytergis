import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useRef } from 'react';

import {
  colorToRgba,
  RgbaColor,
} from '@/src/features/layers/symbology/colorRampUtils';
import RgbaColorPicker from '@/src/features/layers/symbology/components/color_ramp/RgbaColorPicker';
import { IStopRow } from '@/src/features/layers/symbology/symbologyDialog';
import { SymbologyValue, SizeValue, ColorValue } from '@/src/types';

const StopRow: React.FC<{
  index: number;
  dataValue: number | string;
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
    const value = event.target.value;
    newRows[index].stop = useNumber ? +value : value;
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
    newRows[index].output = +event.target.value;
    setStopRows(newRows);
  };

  const handleColorOutputChange = (color: RgbaColor) => {
    const newRows = [...stopRows];
    newRows[index].output = color;
    setStopRows(newRows);
  };

  return (
    <div className="jp-gis-color-row">
      <input
        id={`jp-gis-color-value-${index}`}
        type={useNumber ? 'number' : 'text'}
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
        <RgbaColorPicker
          color={colorToRgba(symbologyValue as ColorValue)}
          onChange={handleColorOutputChange}
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
