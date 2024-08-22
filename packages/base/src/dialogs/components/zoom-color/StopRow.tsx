import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from '@jupyterlab/ui-components';
import React, { useState } from 'react';
import { IStopRow } from '../../zoomColor';

const StopRow = ({
  index,
  zoom,
  outputValue,
  stopRows,
  setStopRows
}: {
  index: number;
  zoom: number;
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

  const handleZoomChange = event => {
    const newRows = [...stopRows];
    stopRows[index].zoom = event.target.value;
    setStopRows(newRows);
    setInputZoom(event.target.value);
  };

  const handleColorChange = event => {
    const newRows = [...stopRows];
    stopRows[index].outputValue = event.target.value;
    setStopRows(newRows);
    setInputColor(event.target.value);
  };

  return (
    <div className="jp-gis-color-row">
      <input
        id={`jp-gis-color-zoom-${index}`}
        type="number"
        defaultValue={zoom}
        onChange={handleZoomChange}
      />
      <input
        id={`jp-gis-color-color-${index}`}
        value={outputValue}
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
