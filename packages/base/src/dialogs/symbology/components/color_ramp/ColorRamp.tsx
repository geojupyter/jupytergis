import { IDict } from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useState } from 'react';

import { COLOR_RAMP_DEFINITIONS } from '@/src/dialogs/symbology/rampNames';
import { LoadingIcon } from '@/src/shared/components/loading';
import { ColorRampName } from '@/src/types';
import CanvasSelectComponent from './CanvasSelectComponent';
import { ColorRampValueControls } from './ColorRampValueControls';
import ModeSelectRow from './ModeSelectRow';
interface IColorRampProps {
  modeOptions: string[];
  layerParams: IDict;
  classifyFunc: (
    selectedMode: string,
    numberOfShades: string,
    selectedRamp: ColorRampName,
    setIsLoading: (isLoading: boolean) => void,
    criticalValue?: number,
    minValue?: number,
    maxValue?: number,
  ) => void;
  showModeRow: boolean;
  showRampSelector: boolean;
  renderType?:
    | 'Graduated'
    | 'Categorized'
    | 'Heatmap'
    | 'Singleband Pseudocolor';
  initialMin?: number;
  initialMax?: number;
}

export type ColorRampOptions = {
  selectedRamp: ColorRampName;
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
  initialMin,
  initialMax,
}) => {
  const [selectedRamp, setSelectedRamp] = useState<ColorRampName>('viridis');
  const [selectedMode, setSelectedMode] = useState('');
  const [numberOfShades, setNumberOfShades] = useState('');
  const [minValue, setMinValue] = useState<number | undefined>(initialMin);
  const [maxValue, setMaxValue] = useState<number | undefined>(initialMax);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedMode === '' && numberOfShades === '') {
      initializeState();
    }
  }, [layerParams]);

  useEffect(() => {
    if (renderType === 'Graduated') {
      if (initialMin !== undefined) {
        setMinValue(initialMin);
      }
      if (initialMax !== undefined) {
        setMaxValue(initialMax);
      }
    }
  }, [initialMin, initialMax, renderType]);

  const initializeState = () => {
    let nClasses, singleBandMode, colorRamp;

    if (layerParams.symbologyState) {
      nClasses = layerParams.symbologyState.nClasses;
      singleBandMode = layerParams.symbologyState.mode;
      colorRamp = layerParams.symbologyState.colorRamp;
    }
    setNumberOfShades(nClasses ? nClasses : '9');
    setSelectedMode(singleBandMode ? singleBandMode : 'equal interval');
    setSelectedRamp(colorRamp ? colorRamp : 'viridis');
  };

  const rampDef = COLOR_RAMP_DEFINITIONS[selectedRamp];

  const normalizedCritical =
    rampDef?.type === 'Divergent' ? (rampDef.criticalValue ?? 0.5) : 0.5;
  const scaledCritical =
    minValue !== undefined && maxValue !== undefined
      ? minValue + normalizedCritical * (maxValue - minValue)
      : undefined;

  let displayMin = minValue;
  let displayMax = maxValue;

  if (
    rampDef?.type === 'Divergent' &&
    renderType === 'Graduated' &&
    displayMin !== undefined &&
    displayMax !== undefined
  ) {
    const absMax = Math.max(
      minValue ?? Math.abs(displayMin),
      maxValue ?? Math.abs(displayMax),
    );
    displayMin = -absMax;
    displayMax = absMax;
  }

  useEffect(() => {
    if (!layerParams.symbologyState) {
      layerParams.symbologyState = {};
    }

    if (renderType !== 'Heatmap') {
      layerParams.symbologyState.min = minValue;
      layerParams.symbologyState.max = maxValue;
      layerParams.symbologyState.colorRamp = selectedRamp;
      layerParams.symbologyState.nClasses = numberOfShades;
      layerParams.symbologyState.mode = selectedMode;

      if (rampDef?.type === 'Divergent') {
        layerParams.symbologyState.criticalValue = rampDef.criticalValue;
      }
    }
  }, [minValue, maxValue, selectedRamp, selectedMode, numberOfShades]);

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

      <ColorRampValueControls
        selectedMin={displayMin}
        settedMin={setMinValue}
        selectedMax={displayMax}
        settedMax={setMaxValue}
        rampDef={rampDef}
        dataMin={initialMin}
        dataMax={initialMax}
        renderType={renderType}
      />

      {isLoading ? (
        <LoadingIcon />
      ) : (
        <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          disabled={minValue === undefined || maxValue === undefined}
          onClick={() =>
            classifyFunc(
              selectedMode,
              numberOfShades,
              selectedRamp,
              setIsLoading,
              scaledCritical,
              displayMin,
              displayMax,
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
