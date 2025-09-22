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
    minValue: number,
    maxValue: number,
    criticalValue?: number,
  ) => void;
  showModeRow: boolean;
  showRampSelector: boolean;
  renderType:
    | 'Graduated'
    | 'Categorized'
    | 'Heatmap'
    | 'Singleband Pseudocolor';
  reverse: boolean;
  setReverse: React.Dispatch<React.SetStateAction<boolean>>;
  dataMin?: number;
  dataMax?: number;
}

export type ColorRampOptions = {
  selectedRamp: ColorRampName;
  numberOfShades: string;
  selectedMode: string;
  minValue: number;
  maxValue: number;
  criticalValue?: number;
};

const ColorRamp: React.FC<IColorRampProps> = ({
  layerParams,
  modeOptions,
  classifyFunc,
  showModeRow,
  showRampSelector,
  renderType,
  reverse = true,
  setReverse,
  dataMin,
  dataMax,
}) => {
  const [selectedRamp, setSelectedRamp] = useState<ColorRampName>('viridis');
  const [selectedMode, setSelectedMode] = useState('');
  const [numberOfShades, setNumberOfShades] = useState('');
  const [minValue, setMinValue] = useState<number | undefined>(dataMin);
  const [maxValue, setMaxValue] = useState<number | undefined>(dataMax);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedMode === '' && numberOfShades === '') {
      initializeState();
    }
  }, [layerParams]);

  useEffect(() => {
    if (renderType) {
      if (dataMin !== undefined) {
        setMinValue(dataMin);
      }
      if (dataMax !== undefined) {
        setMaxValue(dataMax);
      }
    }
  }, [dataMin, dataMax, renderType]);

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

  useEffect(() => {
    if (!layerParams.symbologyState) {
      layerParams.symbologyState = {};
    }

    if (renderType !== 'Heatmap') {
      layerParams.symbologyState.dataMin;
      layerParams.symbologyState.dataMax;
      layerParams.symbologyState.min = minValue;
      layerParams.symbologyState.max = maxValue;
      layerParams.symbologyState.colorRamp = selectedRamp;
      layerParams.symbologyState.nClasses = numberOfShades;
      layerParams.symbologyState.mode = selectedMode;

      if (rampDef?.type === 'Divergent') {
        layerParams.symbologyState.criticalValue = rampDef.criticalValue;
      }
    }
  }, [
    minValue,
    maxValue,
    selectedRamp,
    selectedMode,
    numberOfShades,
    dataMin,
    dataMax,
  ]);

  return (
    <div className="jp-gis-color-ramp-container">
      {showRampSelector && (
        <div className="jp-gis-symbology-row">
          <label htmlFor="color-ramp-select">Color Ramp:</label>
          <CanvasSelectComponent
            selectedRamp={selectedRamp}
            setSelected={setSelectedRamp}
            reverse={reverse}
            setReverse={setReverse}
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
        selectedMin={minValue}
        settedMin={setMinValue}
        selectedMax={maxValue}
        settedMax={setMaxValue}
        rampDef={rampDef}
        dataMin={dataMin}
        dataMax={dataMax}
        renderType={renderType}
      />

      {isLoading ? (
        <LoadingIcon />
      ) : (
        <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          disabled={minValue === undefined || maxValue === undefined}
          onClick={() => {
            if (minValue === undefined || maxValue === undefined) {
              return;
            }

            classifyFunc(
              selectedMode,
              numberOfShades,
              selectedRamp,
              setIsLoading,
              minValue,
              maxValue,
              scaledCritical,
            );
          }}
        >
          Classify
        </Button>
      )}
    </div>
  );
};

export default ColorRamp;
