import { Button } from '@jupyterlab/ui-components';
import React from 'react';

import { IColorRampValueControlsProps } from '@/src/types';

export const ColorRampValueControls: React.FC<IColorRampValueControlsProps> = ({
  min,
  setMin,
  max,
  setMax,
  rampDef,
  initialMin,
  initialMax,
  renderType,
}) => {
  return (
    <>
      <div className="jp-gis-symbology-row">
        <label htmlFor="min-value">Min Value:</label>
        <input
          id="min-value"
          type="number"
          value={min ?? ''}
          onChange={e =>
            setMin(
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
          <input
            id="critical-value"
            type="number"
            value={rampDef.criticalValue ?? ''}
            readOnly
            className="jp-mod-styled"
            placeholder="Auto-calculated"
          />
        </div>
      )}

      <div className="jp-gis-symbology-row">
        <label htmlFor="max-value">Max Value:</label>
        <input
          id="max-value"
          type="number"
          value={max ?? ''}
          onChange={e =>
            setMax(
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
            disabled={min === initialMin && max === initialMax}
            onClick={() => {
              setMin(initialMin);
              setMax(initialMax);
            }}
          >
            Use Actual Range
          </Button>
        </div>
      }
    </>
  );
};
