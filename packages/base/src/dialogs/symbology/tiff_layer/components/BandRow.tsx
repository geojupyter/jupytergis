import React from 'react';

import { IBandRow } from '@/src/dialogs/symbology/hooks/useGetMultiBandInfo';

interface IBandRowProps {
  label: string;
  index: number;
  bandRow: IBandRow;
  bandRows: IBandRow[];
  setSelectedBand: (band: number) => void;
  setBandRows?: (bandRows: IBandRow[]) => void;
  isMultibandColor?: boolean;
}

/**
 *
 * @param label Label displayed in symbology dialog
 * @param index Index of current row in band row data
 * @param bandRow Band from bands array, will be undefined when band is 'unset' in Multiband color
 * @param bandRows Bands array from tiff data
 * @param setSelectedBand Function to set selected band parent
 * @param setBandRows Function to update band rows in parent
 * @param isMultibandColor Used to hide min/max input and add 'Unset' option to drop down menu for MultiBand symbology
 */
const BandRow: React.FC<IBandRowProps> = ({
  label,
  index,
  bandRow,
  bandRows,
  setSelectedBand,
  isMultibandColor,
}) => {
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
                selected={band.band === bandRow?.band}
                className="jp-mod-styled"
              >
                {band.colorInterpretation
                  ? `Band ${band.band} (${band.colorInterpretation})`
                  : `Band ${band.band}`}
              </option>
            ))}
            {isMultibandColor ? (
              <option
                key={'unset'}
                value={-1}
                selected={!bandRow}
                className="jp-mod-styled"
              >
                Unset
              </option>
            ) : null}
          </select>
        </div>
      </div>
    </>
  );
};

export default BandRow;
