/**
 * @module ColorRampControls
 *
 * This component provides the main UI controls for classifying raster layers
 * using different color ramps and classification modes.
 *
 * Allows users to:
 * - Select a color ramp (`ColorRampSelector`)
 * - Choose classification mode and number of classes (`ModeSelectRow`)
 * - Run classification via `classifyFunc`, with loading state (`LoadingIcon`)
 *
 * Props:
 * - `modeOptions`: Available classification modes.
 * - `layerParams`: Layer symbology state.
 * - `classifyFunc`: Callback for classification.
 * - `showModeRow`: Toggle for mode selector.
 * - `showRampSelector`: Toggle for ramp selector.
 */

import { IDict } from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useState } from 'react';

import {
  COLOR_RAMP_DEFINITIONS,
  COLOR_RAMP_DEFAULTS,
} from '@/src/dialogs/symbology/colorRamps';
import { LoadingIcon } from '@/src/shared/components/loading';
import { ColorRampName, ClassificationMode } from '@/src/types';
import ColorRampSelector from './ColorRampSelector';
import { ColorRampValueControls } from './ColorRampValueControls';
import ModeSelectRow from './ModeSelectRow';

interface IColorRampControlsProps {
  modeOptions: ClassificationMode[];
  layerParams: IDict;
  classifyFunc: (
    selectedMode: ClassificationMode,
    numberOfShades: number,
    selectedRamp: ColorRampName,
    reverseRamp: boolean,
    setIsLoading: (isLoading: boolean) => void,
    minValue: number,
    maxValue: number,
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

export type ColorRampControlsOptions = {
  selectedRamp: ColorRampName;
  numberOfShades: number;
  selectedMode: ClassificationMode;
  minValue: number;
  maxValue: number;
  criticalValue?: number;
  reverseRamp: boolean;
  dataMin?: number;
  dataMax?: number;
};

const isValidNumberOfShades = (value: number) => !isNaN(value) && value > 0;

const ColorRampControls: React.FC<IColorRampControlsProps> = ({
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
  const [selectedMode, setSelectedMode] =
    useState<ClassificationMode>('equal interval');
  const [numberOfShades, setNumberOfShades] = useState<number>(9);
  const [minValue, setMinValue] = useState<number | undefined>(dataMin);
  const [maxValue, setMaxValue] = useState<number | undefined>(dataMax);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    initializeState();
  }, []);

  useEffect(() => {
    setMinValue(layerParams.symbologyState?.min ?? dataMin);
    setMaxValue(layerParams.symbologyState?.max ?? dataMax);
  }, [dataMin, dataMax]);

  useEffect(() => {
    if (!selectedRamp) {
      return;
    }

    const defaultClasses = COLOR_RAMP_DEFAULTS[selectedRamp] ?? 9;

    setNumberOfShades(defaultClasses);
    setWarning(null);
  }, [selectedRamp]);

  useEffect(() => {
    if (!selectedRamp || !numberOfShades) {
      return;
    }

    const minRequired = COLOR_RAMP_DEFAULTS[selectedRamp];
    const shades = numberOfShades;
    const rampLabel = selectedRamp
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('-');

    if (minRequired && shades < minRequired) {
      setWarning(
        `${rampLabel} requires at least ${minRequired} classes (got ${shades})`,
      );
    } else {
      setWarning(null);
    }
  }, [selectedRamp, numberOfShades]);
  const initializeState = () => {
    const { nClasses, mode, colorRamp, reverseRamp } =
      layerParams.symbologyState ?? {};
    setNumberOfShades(Number(nClasses ?? 9));
    setSelectedMode((mode as ClassificationMode) ?? 'equal interval');
    setSelectedRamp((colorRamp as ColorRampName) ?? 'viridis');
    setReverseRamp(reverseRamp ?? false);
  };

  const rampDef = COLOR_RAMP_DEFINITIONS[selectedRamp];

  if (rampDef === undefined) {
    // Typeguard: This should never happen
    return;
  }

  return (
    <div className="jp-gis-color-ramp-container">
      {showRampSelector && (
        <div className="jp-gis-symbology-row">
          <label htmlFor="color-ramp-select">Color Ramp:</label>
          <ColorRampSelector
            selectedRamp={selectedRamp}
            setSelected={setSelectedRamp}
            reverse={reverseRamp}
            setReverse={setReverseRamp}
          />
        </div>
      )}

      <ColorRampValueControls
        selectedMin={minValue}
        setSelectedMin={setMinValue}
        selectedMax={maxValue}
        setSelectedMax={setMaxValue}
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
      {warning && (
        <div
          className="jp-gis-warning"
          style={{ color: 'orange', marginTop: 4 }}
        >
          {warning}
        </div>
      )}
      {isLoading ? (
        <LoadingIcon />
      ) : (
        <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          disabled={
            !isValidNumberOfShades(numberOfShades) ||
            !selectedMode ||
            minValue === undefined ||
            maxValue === undefined ||
            !!warning
          }
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
            );
          }}
        >
          Classify
        </Button>
      )}
    </div>
  );
};

export default ColorRampControls;
