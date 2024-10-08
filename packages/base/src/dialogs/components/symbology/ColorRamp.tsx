import { Button } from '@jupyterlab/ui-components';
import colormap from 'colormap';
import React, { useState } from 'react';
import { calculateQuantileBreaks } from '../../../classificationModes';
import { IStopRow } from '../../symbologyDialog';
import CanvasSelectComponent from './CanvasSelectComponent';
interface IColorRampProps {
  featureProperties: any;
  selectedValue: string;
  setStopRows: (stopRows: IStopRow[]) => void;
}

const ColorRamp = ({
  featureProperties,
  selectedValue,
  setStopRows
}: IColorRampProps) => {
  const [selectedRamp, setSelectedRamp] = useState('cool');
  const [numberOfShades, setNumberOfShades] = useState('9');

  const buildColorInfoFromClassification = () => {
    const stops = calculateQuantileBreaks(
      [...featureProperties[selectedValue]],
      +numberOfShades
    );
    const colorMap = colormap({
      colormap: selectedRamp,
      nshades: +numberOfShades,
      format: 'rgba'
    });

    const valueColorPairs: IStopRow[] = [];

    // assume stops and colors are same length
    for (let i = 0; i < +numberOfShades; i++) {
      valueColorPairs.push({ stop: stops[i], output: colorMap[i] });
    }

    setStopRows(valueColorPairs);
  };

  return (
    <div className="jp-gis-color-ramp-container">
      <div className="jp-gis-symbology-row">
        <label htmlFor="color-ramp-select">Color Ramp:</label>
        <CanvasSelectComponent setSelected={setSelectedRamp} />
      </div>
      <div className="jp-gis-symbology-row">
        <div className="jp-gis-color-ramp-div">
          <label htmlFor="class-number-input">Classes:</label>
          <input
            className="jp-mod-styled"
            name="class-number-input"
            type="number"
            value={numberOfShades}
            onChange={event => setNumberOfShades(event.target.value)}
          />
        </div>
        <div className="jp-gis-color-ramp-div">
          <label htmlFor="mode-select">Mode:</label>
          <select name="mode-select">
            <option className="jp-mod-styled" value="quantile">
              Quantile
            </option>
          </select>
        </div>
      </div>
      <Button
        className="jp-Dialog-button jp-mod-accept jp-mod-styled"
        onClick={buildColorInfoFromClassification}
      >
        Classify
      </Button>
      <canvas width="512" height="50" id="cv"></canvas>
    </div>
  );
};

export default ColorRamp;
