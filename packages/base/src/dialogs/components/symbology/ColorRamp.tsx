import { Button } from '@jupyterlab/ui-components';
import React from 'react';

const ColorRamp = () => {
  return (
    <div className="jp-gis-color-ramp-container">
      <div className="jp-gis-symbology-row">
        <label htmlFor="color-ramp-select">Color Ramp:</label>
        <select name="color-ramp-select">
          <option className="jp-mod-styled" value="blue">
            Blue
          </option>
        </select>
      </div>
      <div className="jp-gis-symbology-row">
        <div className="jp-gis-color-ramp-div">
          <label htmlFor="class-number-input">Classes:</label>
          <input
            className="jp-mod-styled"
            name="class-number-input"
            type="number"
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
      <Button className="jp-Dialog-button jp-mod-accept jp-mod-styled">
        Classify
      </Button>
    </div>
  );
};

export default ColorRamp;
