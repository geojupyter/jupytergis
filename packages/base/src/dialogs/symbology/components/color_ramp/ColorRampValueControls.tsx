import { Button } from '@jupyterlab/ui-components';
import React from 'react';

import { IColorRampDefinition } from '@/src/types';

export interface IColorRampValueControlsProps {
  selectedMin: number | undefined;
  settedMin: (v: number | undefined) => void;
  selectedMax: number | undefined;
  settedMax: (v: number | undefined) => void;
  rampDef: IColorRampDefinition;
  renderType:
    | 'Categorized'
    | 'Graduated'
    | 'Heatmap'
    | 'Singleband Pseudocolor';
  dataMin?: number;
  dataMax?: number;
  selectedMode: string; // TODO: should be ClssificationMode
}
export const ColorRampValueControls: React.FC<IColorRampValueControlsProps> = (props) => {
  const permittedRenderTypes = ['Graduated', 'Singleband Pseudocolor'];
  if (!permittedRenderTypes.includes(props.renderType)) {
    return;
  }

  const enableMinMax = props.selectedMode === 'equal interval';
  return (
    <>
      <div className="jp-gis-symbology-row">
        <label htmlFor="min-value">Min Value:</label>
        <input
          id="min-value"
          type="number"
          value={props.selectedMin ?? ''}
          onChange={e =>
            props.settedMin(
              e.target.value !== '' ? parseFloat(e.target.value) : undefined,
            )
          }
          className={'jp-mod-styled'}
          placeholder="Enter min value"
          disabled={!enableMinMax}
        />
      </div>

      {props.rampDef.type === 'Divergent' &&
        props.dataMin !== undefined &&
        props.dataMax !== undefined && (
          <div className="jp-gis-symbology-row">
            <label htmlFor="critical-value">Critical Value:</label>
            <span id="critical-value" className="jp-mod-styled">
              {`${(
                props.dataMin +
                (props.rampDef.criticalValue ?? 0.5) * (props.dataMax - props.dataMin)
              ).toFixed(1)} (Colormap diverges at 50%)`}
            </span>
          </div>
        )}

      <div className="jp-gis-symbology-row">
        <label htmlFor="max-value">Max Value:</label>
        <input
          id="max-value"
          type="number"
          value={props.selectedMax ?? ''}
          onChange={e =>
            props.settedMax(
              e.target.value !== '' ? parseFloat(e.target.value) : undefined,
            )
          }
          className={'jp-mod-styled'}
          placeholder="Enter max value"
          disabled={!enableMinMax}
        />
      </div>

      <div className="jp-gis-symbology-row">
        {!enableMinMax ? (
          <div className="errors">
            ⚠️ Warning: User-specified min/max values are only applied in Equal
            Interval mode.
          </div>
        ) : (
          <div></div>
        )}

        <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          disabled={!enableMinMax || (props.selectedMin === props.dataMin && props.selectedMax === props.dataMax)}
          onClick={() => {
            props.settedMin(props.dataMin);
            props.settedMax(props.dataMax);
          }}
        >
          Use Actual Range ({props.dataMin} - {props.dataMax})
        </Button>
      </div>
    </>
  );
};
