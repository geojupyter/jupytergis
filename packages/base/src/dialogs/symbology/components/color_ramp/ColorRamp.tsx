import { IDict } from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useState } from 'react';

import {
  COLOR_RAMP_DEFINITIONS,
  ColorRampName,
} from '@/src/dialogs/symbology/colorRampUtils';
import { LoadingIcon } from '@/src/shared/components/loading';
import CanvasSelectComponent from './CanvasSelectComponent';
import { ColorRampValueControls } from './ColorRampValueControls';
import ModeSelectRow from './ModeSelectRow';
interface IColorRampProps {
  modeOptions: string[];
  layerParams: IDict;
  classifyFunc: (
    selectedMode: string,
    numberOfShades: string,
    selectedRamp: string,
    setIsLoading: (isLoading: boolean) => void,
    criticalValue?: number,
    minValue?: number,
    maxValue?: number,
  ) => void;
  showModeRow: boolean;
  showRampSelector: boolean;
  renderType?: 'graduated' | 'categorized' | 'heatmap' | 'singleband';
}

export type ColorRampOptions = {
  selectedRamp: string;
  numberOfShades: string;
  selectedMode: string;
  minValue?: number;
  maxValue?: number;
  criticalValue?: number;
};

const ColorRamp: React.FC<IColorRampProps> = ({
  layerParams,
  modeOptions,
  classifyFunc,
  showModeRow,
  showRampSelector,
  renderType,
}) => {
  const [selectedRamp, setSelectedRamp] = useState('');
  const [selectedMode, setSelectedMode] = useState('');
  const [numberOfShades, setNumberOfShades] = useState('');
  const [minValue, setMinValue] = useState<number | undefined>(-5);
  const [maxValue, setMaxValue] = useState<number | undefined>(5);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedRamp === '' && selectedMode === '' && numberOfShades === '') {
      populateOptions();
    }
  }, [layerParams]);

  useEffect(() => {
    if (!layerParams.symbologyState) {
      layerParams.symbologyState = {};
    }

    if (renderType !== 'heatmap') {
      layerParams.symbologyState.min = minValue;
      layerParams.symbologyState.max = maxValue;
      layerParams.symbologyState.colorRamp = selectedRamp;
      layerParams.symbologyState.nClasses = numberOfShades;
      layerParams.symbologyState.mode = selectedMode;

      if (rampDef?.type === 'Divergent') {
        layerParams.symbologyState.criticalValue = scaledCritical;
      }
    }
  }, [minValue, maxValue, selectedRamp, selectedMode, numberOfShades]);

  const populateOptions = () => {
    let nClasses, singleBandMode, colorRamp, min, max;

    if (layerParams.symbologyState) {
      nClasses = layerParams.symbologyState.nClasses;
      singleBandMode = layerParams.symbologyState.mode;
      colorRamp = layerParams.symbologyState.colorRamp;
      min = layerParams.symbologyState.min;
      max = layerParams.symbologyState.max;
    }
    setNumberOfShades(nClasses ? nClasses : '9');
    setSelectedMode(singleBandMode ? singleBandMode : 'equal interval');
    setSelectedRamp(colorRamp ? colorRamp : 'viridis');
    setMinValue(min !== undefined ? min : -5);
    setMaxValue(max !== undefined ? max : 5);
  };

  const rampDef = COLOR_RAMP_DEFINITIONS[selectedRamp as ColorRampName];
  const normalizedCritical =
    rampDef?.type === 'Divergent' ? (rampDef.criticalValue ?? 0.5) : 0.5;
  const scaledCritical =
    minValue !== undefined && maxValue !== undefined
      ? minValue + normalizedCritical * (maxValue - minValue)
      : undefined;

  return (
    <div className="jp-gis-color-ramp-container">
      {showRampSelector && (
        <div className="jp-gis-symbology-row">
          <label htmlFor="color-ramp-select">Color Ramp:</label>
          <CanvasSelectComponent
            selectedRamp={selectedRamp}
            setSelected={setSelectedRamp}
          />
        </div>
      )}
      {showModeRow && (
        <ModeSelectRow
          modeOptions={modeOptions}
          numberOfShades={numberOfShades}
          setNumberOfShades={setNumberOfShades}
          selectedMode={selectedMode}
          setSelectedMode={setSelectedMode}
        />
      )}
      {rampDef && (
        <ColorRampValueControls
          min={minValue}
          setMin={setMinValue}
          max={maxValue}
          setMax={setMaxValue}
          rampDef={rampDef}
        />
      )}

      {isLoading ? (
        <LoadingIcon />
      ) : (
        <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          onClick={() =>
            classifyFunc(
              selectedMode,
              numberOfShades,
              selectedRamp,
              setIsLoading,
              scaledCritical,
              minValue,
              maxValue,
            )
          }
        >
          Classify
        </Button>
      )}
    </div>
  );
};

export default ColorRamp;
