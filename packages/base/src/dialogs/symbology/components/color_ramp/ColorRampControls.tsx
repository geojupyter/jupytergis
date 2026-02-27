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

import { LoadingIcon } from '@/src/shared/components/loading';
import { ClassificationMode } from '@/src/types';
import ColorRampSelector from './ColorRampSelector';
import ModeSelectRow from './ModeSelectRow';
import { COLOR_RAMP_DEFAULTS, ColorRampName } from '../../colorRampUtils';

interface IColorRampControlsProps {
  modeOptions: ClassificationMode[];
  layerParams: IDict;
  classifyFunc: (
    selectedMode: ClassificationMode,
    numberOfShades: number,
    selectedRamp: ColorRampName,
    reverseRamp: boolean,
    setIsLoading: (isLoading: boolean) => void,
  ) => void;
  showModeRow: boolean;
  showRampSelector: boolean;
}

export type ColorRampControlsOptions = {
  selectedRamp: ColorRampName;
  numberOfShades: number;
  selectedMode: ClassificationMode;
  reverseRamp: boolean;
};

const isValidNumberOfShades = (value: number) => !isNaN(value) && value > 0;

const ColorRampControls: React.FC<IColorRampControlsProps> = ({
  layerParams,
  modeOptions,
  classifyFunc,
  showModeRow,
  showRampSelector,
}) => {
  const [selectedRamp, setSelectedRamp] = useState<ColorRampName>('viridis');
  const [selectedMode, setSelectedMode] =
    useState<ClassificationMode>('equal interval');
  const [numberOfShades, setNumberOfShades] = useState<number>(9);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [reverseRamp, setReverseRamp] = useState<boolean>(false);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (layerParams.symbologyState) {
      populateOptions();
    }
  }, [
    layerParams.symbologyState.nClasses,
    layerParams.symbologyState.mode,
    layerParams.symbologyState.colorRamp,
  ]);

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
  const populateOptions = () => {
    const { nClasses, mode, colorRamp, reverseRamp } =
      layerParams.symbologyState ?? {};
    setNumberOfShades(Number(nClasses ?? 9));
    setSelectedMode((mode as ClassificationMode) ?? 'equal interval');
    setSelectedRamp((colorRamp as ColorRampName) ?? 'viridis');
    setReverseRamp(Boolean(reverseRamp ?? false));
  };

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
            !isValidNumberOfShades(numberOfShades) || !selectedMode || !!warning
          }
          onClick={() =>
            classifyFunc(
              selectedMode,
              numberOfShades,
              selectedRamp,
              reverseRamp,
              setIsLoading,
            )
          }
        >
          Classify
        </Button>
      )}
    </div>
  );
};

export default ColorRampControls;
