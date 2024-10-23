import React from 'react';
interface IModeSelectRowProps {
  numberOfShades: string;
  setNumberOfShades: (value: string) => void;
  selectedMode: string;
  setSelectedMode: (value: string) => void;
  modeOptions: string[];
}
const ModeSelectRow = ({
  numberOfShades,
  setNumberOfShades,
  selectedMode,
  setSelectedMode,
  modeOptions
}: IModeSelectRowProps) => {
  return (
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
            <option
              className="jp-mod-styled"
              value={mode}
              selected={selectedMode === mode}
            >
              {mode}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default ModeSelectRow;
