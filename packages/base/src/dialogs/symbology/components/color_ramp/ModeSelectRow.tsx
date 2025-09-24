import React from 'react';

import { ClassificationMode } from '@/src/types';
interface IModeSelectRowProps {
  numberOfShades: number | undefined;
  setNumberOfShades: (value: number | undefined) => void;
  selectedMode: ClassificationMode | undefined;
  setSelectedMode: (value: ClassificationMode | undefined) => void;
  modeOptions: ClassificationMode[];
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
          value={selectedMode === 'continuous' ? 52 : (numberOfShades ?? '')}
          onChange={event => {
            const value = event.target.value;
            setNumberOfShades(value === '' ? undefined : Number(value));
          }}
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
            onChange={event =>
              setSelectedMode(event.target.value as ClassificationMode)
            }
          >
            {modeOptions.map(mode => (
              <option key={mode} value={mode}>
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
