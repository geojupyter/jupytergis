import { Button } from '@jupyterlab/ui-components';
import React from 'react';

import { IColorRampDefinition, ClassificationMode } from '@/src/types';

export interface IColorRampValueControlsProps {
  selectedMin: number | undefined;
  setSelectedMin: React.Dispatch<React.SetStateAction<number | undefined>>;
  selectedMax: number | undefined;
  setSelectedMax: React.Dispatch<React.SetStateAction<number | undefined>>;
  rampDef: IColorRampDefinition;
  renderType:
    | 'Categorized'
    | 'Graduated'
    | 'Heatmap'
    | 'Singleband Pseudocolor';
  dataMin?: number;
  dataMax?: number;
  selectedMode: ClassificationMode;
}
export const ColorRampValueControls: React.FC<
  IColorRampValueControlsProps
> = props => {
  const permittedRenderTypes = ['Graduated', 'Singleband Pseudocolor'];
  if (!permittedRenderTypes.includes(props.renderType)) {
    return;
  }

  const modesSupportingMinMax = ['equal interval', 'continuous'];
  const enableMinMax = modesSupportingMinMax.includes(props.selectedMode);

  const formatMode = (mode: string) =>
    mode.charAt(0).toUpperCase() + mode.slice(1);

  return (
    <>
      {props.rampDef.type === 'Divergent' &&
        props.selectedMode === 'equal interval' &&
        props.selectedMin !== undefined &&
        props.selectedMax !== undefined && (
          <div className="jp-gis-symbology-row">
            <label htmlFor="critical-value">Critical Value:</label>
            <span id="critical-value" className="jp-mod-styled">
              {`${(
                props.selectedMin +
                props.rampDef.criticalValue *
                  (props.selectedMax - props.selectedMin)
              ).toFixed(
                2,
              )} (Colormap diverges at ${props.rampDef.criticalValue * 100}%)`}
            </span>
          </div>
        )}

      <div className="jp-gis-symbology-row">
        <label htmlFor="min-value">Min Value:</label>
        <input
          id="min-value"
          type="number"
          value={props.selectedMin ?? ''}
          onChange={e =>
            props.setSelectedMin(
              e.target.value !== '' ? parseFloat(e.target.value) : undefined,
            )
          }
          className={'jp-mod-styled'}
          placeholder="Enter min value"
          disabled={!enableMinMax}
        />
      </div>

      <div className="jp-gis-symbology-row">
        <label htmlFor="max-value">Max Value:</label>
        <input
          id="max-value"
          type="number"
          value={props.selectedMax ?? ''}
          onChange={e =>
            props.setSelectedMax(
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
            ⚠️ Warning: User-specified min/max values are not supported for "
            {formatMode(props.selectedMode)}" mode.
          </div>
        ) : (
          <div></div>
        )}

        <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          disabled={
            !enableMinMax ||
            (props.selectedMin === props.dataMin &&
              props.selectedMax === props.dataMax)
          }
          onClick={() => {
            props.setSelectedMin(props.dataMin);
            props.setSelectedMax(props.dataMax);
          }}
        >
          Use Actual Range ({props.dataMin} - {props.dataMax})
        </Button>
      </div>
    </>
  );
};
