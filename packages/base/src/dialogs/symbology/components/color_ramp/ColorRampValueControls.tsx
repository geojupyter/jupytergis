import { Button } from '@jupyterlab/ui-components';
import React from 'react';

import { IColorRampDefinition } from '@/src/types';

export interface IColorRampValueControlsProps {
  selectedMin: number | undefined;
  settedMin: (v: number | undefined) => void;
  selectedMax: number | undefined;
  settedMax: (v: number | undefined) => void;
  rampDef: IColorRampDefinition;
  dataMin?: number;
  dataMax?: number;
  renderType?:
    | 'Categorized'
    | 'Graduated'
    | 'Heatmap'
    | 'Singleband Pseudocolor';
  selectedMode: string; // TODO: should be ClssificationMode | undefined;
}
export const ColorRampValueControls: React.FC<IColorRampValueControlsProps> = ({
  selectedMin,
  settedMin,
  selectedMax,
  settedMax,
  rampDef,
  dataMin,
  dataMax,
  renderType,
  selectedMode,
}) => {
  const applyMinMax =
    renderType === 'Graduated' && selectedMode !== 'equal interval';

  return (
    <>
      <div className="jp-gis-symbology-row">
        <label htmlFor="min-value">Min Value:</label>
        <input
          id="min-value"
          type="number"
          value={selectedMin ?? ''}
          onChange={e =>
            settedMin(
              e.target.value !== '' ? parseFloat(e.target.value) : undefined,
            )
          }
          className={`jp-mod-styled ${
            selectedMode !== 'equal interval' ? 'jp-gis-disabled-input' : ''
          }`}
          placeholder="Enter min value"
          disabled={selectedMode !== 'equal interval'}
        />
      </div>

      {rampDef.type === 'Divergent' &&
        renderType === 'Graduated' &&
        dataMin !== undefined &&
        dataMax !== undefined && (
          <div className="jp-gis-symbology-row">
            <label htmlFor="critical-value">Critical Value:</label>
            <span id="critical-value" className="jp-mod-styled">
              {`${(
                dataMin +
                (rampDef.criticalValue ?? 0.5) * (dataMax - dataMin)
              ).toFixed(1)} (Colormap diverges at 50%)`}
            </span>
          </div>
        )}

      <div className="jp-gis-symbology-row">
        <label htmlFor="max-value">Max Value:</label>
        <input
          id="max-value"
          type="number"
          value={selectedMax ?? ''}
          onChange={e =>
            settedMax(
              e.target.value !== '' ? parseFloat(e.target.value) : undefined,
            )
          }
          className={`jp-mod-styled ${
            selectedMode !== 'equal interval' ? 'jp-gis-disabled-input' : ''
          }`}
          placeholder="Enter max value"
          disabled={selectedMode !== 'equal interval'}
        />
      </div>

      <div className="jp-gis-symbology-row">
        {applyMinMax ? (
          <div className="errors">
            ⚠️ Warning: User-specified min/max values are only applied in Equal
            Interval mode.
          </div>
        ) : (
          <div></div>
        )}

        <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          disabled={selectedMin === dataMin && selectedMax === dataMax}
          onClick={() => {
            settedMin(dataMin);
            settedMax(dataMax);
          }}
        >
          Use Actual Range
        </Button>
      </div>
    </>
  );
};
