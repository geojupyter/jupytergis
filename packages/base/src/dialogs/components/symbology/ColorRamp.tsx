import { Button } from '@jupyterlab/ui-components';
import colormap from 'colormap';
import React, { useState } from 'react';
import {
  calculateEqualIntervalBreaks,
  calculateJenksBreaks,
  calculateLogarithmicBreaks,
  calculatePrettyBreaks,
  calculateQuantileBreaks
} from '../../../classificationModes';
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

  const buildColorInfoFromClassification = () => {
    let stops;

    switch (selectedMode) {
      case 'quantile':
        stops = calculateQuantileBreaks(
          [...featureProperties[selectedValue]],
          +numberOfShades
        );
        break;
      case 'equal interval':
        stops = calculateEqualIntervalBreaks(
          [...featureProperties[selectedValue]],
          +numberOfShades
        );
        break;
      case 'jenks':
        stops = calculateJenksBreaks(
          [...featureProperties[selectedValue]],
          +numberOfShades
        );
        break;
      case 'pretty':
        stops = calculatePrettyBreaks(
          [...featureProperties[selectedValue]],
          +numberOfShades
        );
        break;
      case 'logarithmic':
        stops = calculateLogarithmicBreaks(
          [...featureProperties[selectedValue]],
          +numberOfShades
        );
        break;
      default:
        console.warn('No mode selected');
        return;
    }

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
        onClick={buildColorInfoFromClassification}
      >
        Classify
      </Button>
    </div>
  );
};

export default ColorRamp;
