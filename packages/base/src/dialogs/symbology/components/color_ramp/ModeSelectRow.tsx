import React from 'react';
interface IModeSelectRowProps {
  numberOfShades: string;
  setNumberOfShades: (value: string) => void;
  selectedMode: string;
  setSelectedMode: (value: string) => void;
  modeOptions: string[];
}
const ModeSelectRow: React.FC<IModeSelectRowProps> = props => {
  return (
    <div className="jp-gis-symbology-row">
      <div className="jp-gis-color-ramp-div">
        <label htmlFor="class-number-input">Classes:</label>
        <input
          className="jp-mod-styled"
          name="class-number-input"
          type="number"
          value={props.selectedMode === 'continuous' ? 52 : props.numberOfShades}
          onChange={event => props.setNumberOfShades(event.target.value)}
          disabled={props.selectedMode === 'continuous'}
        />
      </div>
      <div className="jp-gis-color-ramp-div">
        <label htmlFor="mode-select">Mode:</label>
        <div className="jp-select-wrapper">
          <select
            name="mode-select"
            id="mode-select"
            className="jp-mod-styled"
            value={props.selectedMode}
            onChange={event => props.setSelectedMode(event.target.value)}
          >
            {props.modeOptions.map(mode => (
              <option key={mode} value={mode} selected={props.selectedMode === mode}>
                {mode}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default ModeSelectRow;
