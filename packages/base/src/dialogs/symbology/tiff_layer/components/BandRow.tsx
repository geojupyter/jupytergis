import React, { useState } from 'react';
import { IBandRow } from '../types/SingleBandPseudoColor';

interface IBandRowProps {
  label: string;
  index: number;
  bandRow: IBandRow;
  bandRows: IBandRow[];
  setSelectedBand: (band: number) => void;
  setBandRows: (bandRows: IBandRow[]) => void;
  // TODO: QGIS uses these values for contrast enhancement in multiband color
  hideMinMax?: boolean;
}

const BandRow = ({
  label,
  index,
  bandRow,
  bandRows,
  setSelectedBand,
  setBandRows,
  hideMinMax
}: IBandRowProps) => {
  const [minValue, setMinValue] = useState(bandRow.stats.minimum);
  const [maxValue, setMaxValue] = useState(bandRow.stats.maximum);

  const handleMinValueChange = (event: {
    target: { value: string | number };
  }) => {
    setMinValue(+event.target.value);
    setNewBands();
  };

  const handleMaxValueChange = (event: {
    target: { value: string | number };
  }) => {
    setMaxValue(+event.target.value);
    setNewBands();
  };

  const setNewBands = () => {
    const newBandRows = [...bandRows];
    newBandRows[index].stats.minimum = minValue;
    newBandRows[index].stats.maximum = maxValue;
    console.log('newBandRows', newBandRows);
    setBandRows(newBandRows);
  };

  return (
    <>
      <div className="jp-gis-symbology-row">
        <label htmlFor={`band-select-${index}`}>{label}:</label>
        <div className="jp-select-wrapper">
          <select
            name={`band-select-${index}`}
            onChange={event => setSelectedBand(+event.target.value)}
            className="jp-mod-styled"
          >
            {bandRows.map((band, bandIndex) => (
              <option
                key={bandIndex}
                value={band.band}
                selected={band.band === bandRow.band}
                className="jp-mod-styled"
              >
                {`Band ${band.band} (${band.colorInterpretation})`}
              </option>
            ))}
          </select>
        </div>
      </div>
      {hideMinMax ? null : (
        <div className="jp-gis-symbology-row" style={{ gap: '0.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '50%'
            }}
          >
            <label htmlFor="band-min" style={{ alignSelf: 'center' }}>
              Min
            </label>
            <input
              type="number"
              className="jp-mod-styled"
              style={{ marginRight: 15 }}
              value={minValue}
              onChange={handleMinValueChange}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '50%',
              paddingRight: '2px'
            }}
          >
            <label htmlFor="band-max" style={{ alignSelf: 'center' }}>
              Max
            </label>
            <input
              type="number"
              className="jp-mod-styled"
              // defaultValue={bandRow.stats.maximum}
              value={maxValue}
              onChange={handleMaxValueChange}
              onBlur={setNewBands}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default BandRow;
