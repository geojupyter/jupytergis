import React from 'react';
interface IModeSelectRowProps {
  numberOfShades: string;
  setNumberOfShades: (value: string) => void;
  selectedMode: string;
  setSelectedMode: (value: string) => void;
  modeOptions: string[];
}
const ModeSelectRow: React.FC<IModeSelectRowProps> = ({
  numberOfShades,
  setNumberOfShades,
  selectedMode,
  setSelectedMode,
  modeOptions,
}) => {
  return (
    <div className="jp-gis-symbology-row">
      <div className="jp-gis-color-ramp-div">
        <label htmlFor="class-number-input">Classes:</label>
        <input
          className="jp-mod-styled"
          name="class-number-input"
          type="number"
          value={selectedMode === 'continuous' ? 52 : numberOfShades}
          onChange={event => setNumberOfShades(event.target.value)}
          disabled={selectedMode === 'continuous'}
        />
      </div>
      <div className="jp-gis-color-ramp-div">
        <label htmlFor="mode-select">Mode:</label>
        <div className="jp-select-wrapper">
          <select
            name="mode-select"
            id="mode-select"
            className="jp-mod-styled"
            value={selectedMode}
            onChange={event => setSelectedMode(event.target.value)}
          >
            {modeOptions.map(mode => (
              <option key={mode} value={mode} selected={selectedMode === mode}>
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
