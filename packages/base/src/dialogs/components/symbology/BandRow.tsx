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
    <>
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
            defaultValue={bandRow.stats.minimum}
            className="jp-mod-styled"
            style={{ marginRight: 15 }}
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
            defaultValue={bandRow.stats.maximum}
            className="jp-mod-styled"
          />
        </div>
      </div>
    </>
  );
};

export default BandRow;
