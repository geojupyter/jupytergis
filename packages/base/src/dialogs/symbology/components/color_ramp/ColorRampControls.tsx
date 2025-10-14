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
import ColorRampSelector from './ColorRampSelector';
import ModeSelectRow from './ModeSelectRow';

interface IColorRampControlsProps {
  modeOptions: string[];
  layerParams: IDict;
  classifyFunc: (
    selectedMode: string,
    numberOfShades: string,
    selectedRamp: string,
    setIsLoading: (isLoading: boolean) => void,
  ) => void;
  showModeRow: boolean;
  showRampSelector: boolean;
}

export type ColorRampControlsOptions = {
  selectedRamp: string;
  numberOfShades: string;
  selectedMode: string;
};

const ColorRampControls: React.FC<IColorRampControlsProps> = ({
  layerParams,
  modeOptions,
  classifyFunc,
  showModeRow,
  showRampSelector,
}) => {
  const [selectedRamp, setSelectedRamp] = useState('');
  const [selectedMode, setSelectedMode] = useState('');
  const [numberOfShades, setNumberOfShades] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedRamp === '' && selectedMode === '' && numberOfShades === '') {
      populateOptions();
    }
  }, [layerParams]);

  const populateOptions = () => {
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

  return (
    <div className="jp-gis-color-ramp-container">
      {showRampSelector && (
        <div className="jp-gis-symbology-row">
          <label htmlFor="color-ramp-select">Color Ramp:</label>
          <ColorRampSelector
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
