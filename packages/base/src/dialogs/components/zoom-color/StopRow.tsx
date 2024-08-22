import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from '@jupyterlab/ui-components';
import React from 'react';

const StopRow = ({
  index,
  zoom,
  outputValue
}: {
  index: number;
  zoom: number;
  outputValue: string;
  setStopRows: any;
}) => {
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

  return (
    <div className="jp-gis-color-row">
      <input
        id={`jp-gis-color-zoom-${index}`}
        type="number"
        defaultValue={zoom}
      />
      <input
        id={`jp-gis-color-color-${index}`}
        value={rgbaStringToHex(outputValue)}
        type="color"
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
