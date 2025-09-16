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
}) => {
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
          className="jp-mod-styled"
          placeholder="Enter min value"
        />
      </div>

      {rampDef.type === 'Divergent' && renderType === 'Graduated' && (
        <div className="jp-gis-symbology-row">
          <label htmlFor="critical-value">Critical Value:</label>
          <output id="critical-value" className="jp-mod-styled">
            {rampDef.criticalValue ?? 'Auto-calculated'}
          </output>
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
          className="jp-mod-styled"
          placeholder="Enter max value"
        />
      </div>
      {
        <div className="jp-gis-symbology-row">
          <Button
            className="jp-Dialog-button jp-mod-accept jp-mod-styled"
            disabled={selectedMin === dataMin && selectedMax === dataMax}
            onClick={() => {
              settedMin(selectedMin);
              settedMax(selectedMax);
            }}
          >
            Use Actual Range
          </Button>
        </div>
      }
    </>
  );
};
