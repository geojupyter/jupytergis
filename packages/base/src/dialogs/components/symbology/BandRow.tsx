import React from 'react';
import { IBandRow } from './SingleBandPseudoColor';

const BandRow = ({
  index,
  bandRow,
  bandRows,
  setSelectedBand
}: {
  index: number;
  bandRow: IBandRow;
  bandRows: IBandRow[];
  setSelectedBand: any;
}) => {
  return (
    <div className="jp-gis-band-row-container">
      <div className="jp-gis-symbology-row">
        <label htmlFor={`band-select-${index}`}>Band:</label>

      <div className="jp-select-wrapper">
        <select
          name={`band-select-${index}`}
          onChange={event => setSelectedBand(event.target.value)}
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
  );
};

export default BandRow;
