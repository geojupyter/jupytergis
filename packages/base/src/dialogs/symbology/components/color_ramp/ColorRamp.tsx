import { IDict } from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useState } from 'react';

import { COLOR_RAMP_DEFINITIONS } from '@/src/dialogs/symbology/colorRamps';
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
    reverseRamp: boolean,
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
  dataMin?: number;
  dataMax?: number;
}

export type ColorRampOptions = {
  selectedRamp: ColorRampName;
  reverseRamp: boolean;
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
  dataMin,
  dataMax,
}) => {
  const [selectedRamp, setSelectedRamp] = useState<ColorRampName>('viridis');
  const [reverseRamp, setReverseRamp] = useState<boolean>(false);
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
      setMinValue(layerParams.symbologyState.min ?? dataMin);
      setMaxValue(layerParams.symbologyState.max ?? dataMax);
    }
  }, [dataMin, dataMax, renderType]);

  const initializeState = () => {
    let nClasses, singleBandMode, colorRamp, reverseRamp;

    if (layerParams.symbologyState) {
      nClasses = layerParams.symbologyState.nClasses;
      singleBandMode = layerParams.symbologyState.mode;
      colorRamp = layerParams.symbologyState.colorRamp;
      reverseRamp = layerParams.symbologyState.reverse;
    }
    setNumberOfShades(nClasses ?? '9');
    setSelectedMode(singleBandMode ?? 'equal interval');
    setSelectedRamp(colorRamp ?? 'viridis');
    setReverseRamp(reverseRamp ?? false);
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
      layerParams.symbologyState.dataMin = dataMin;
      layerParams.symbologyState.dataMax = dataMax;
      layerParams.symbologyState.min = minValue;
      layerParams.symbologyState.max = maxValue;
      layerParams.symbologyState.colorRamp = selectedRamp;
      layerParams.symbologyState.reverse = reverseRamp;
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
    reverseRamp,
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
            reverse={reverseRamp}
            setReverse={setReverseRamp}
          />
        </div>
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
        selectedMode={selectedMode}
      />

      {showModeRow && (
        <ModeSelectRow
          modeOptions={modeOptions}
          numberOfShades={numberOfShades}
          setNumberOfShades={setNumberOfShades}
          selectedMode={selectedMode}
          setSelectedMode={setSelectedMode}
        />
      )}

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
              reverseRamp,
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
