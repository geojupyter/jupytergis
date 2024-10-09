import { Button } from '@jupyterlab/ui-components';
import React, { useState } from 'react';
import CanvasSelectComponent from './CanvasSelectComponent';

interface IColorRampProps {
  classifyFunc: (
    selectedMode: string,
    numberOfShades: string,
    selectedRamp: string
  ) => void;
}

const ColorRamp = ({ classifyFunc }: IColorRampProps) => {
  const modeOptions = [
    'quantile',
    'equal interval',
    'jenks',
    'pretty',
    'logarithmic'
  ];

  const [selectedRamp, setSelectedRamp] = useState('cool');
  const [selectedMode, setSelectedMode] = useState('quantile');
  const [numberOfShades, setNumberOfShades] = useState('9');

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
          <select
            name="mode-select"
            onChange={event => setSelectedMode(event.target.value)}
          >
            {modeOptions.map(mode => (
              <option className="jp-mod-styled" value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button
        className="jp-Dialog-button jp-mod-accept jp-mod-styled"
        onClick={() => classifyFunc(selectedMode, numberOfShades, selectedRamp)}
      >
        Classify
      </Button>
    </div>
  );
};

export default ColorRamp;
