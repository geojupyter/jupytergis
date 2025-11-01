import { IDict } from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useState } from 'react';

import { LoadingIcon } from '@/src/shared/components/loading';
import { ClassificationMode } from '@/src/types';
import CanvasSelectComponent from './CanvasSelectComponent';
import ModeSelectRow from './ModeSelectRow';
import { ColorRampName } from '../../colorRampUtils';

interface IColorRampProps {
  modeOptions: ClassificationMode[];
  layerParams: IDict;
  classifyFunc: (
    selectedMode: ClassificationMode,
    numberOfShades: number,
    selectedRamp: ColorRampName,
    setIsLoading: (isLoading: boolean) => void,
  ) => void;
  showModeRow: boolean;
  showRampSelector: boolean;
}

export type ColorRampOptions = {
  selectedRamp: ColorRampName;
  numberOfShades: number;
  selectedMode: ClassificationMode;
};

const isValidNumberOfShades = (value: number) => !isNaN(value) && value > 0;

const ColorRamp: React.FC<IColorRampProps> = ({
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

  useEffect(() => {
    if (layerParams.symbologyState) {
      populateOptions();
    }
  }, [
    layerParams.symbologyState.nClasses,
    layerParams.symbologyState.mode,
    layerParams.symbologyState.colorRamp,
  ]);

  const populateOptions = () => {
    const { nClasses, mode, colorRamp } = layerParams.symbologyState ?? {};
    setNumberOfShades(nClasses ?? 9);
    setSelectedMode((mode as ClassificationMode) ?? 'equal interval');
    setSelectedRamp((colorRamp as ColorRampName) ?? 'viridis');
  };

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
      {isLoading ? (
        <LoadingIcon />
      ) : (
        <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          disabled={!isValidNumberOfShades(numberOfShades) || !selectedMode}
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

export default ColorRamp;
