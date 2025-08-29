import { IDict } from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useState } from 'react';

import { LoadingIcon } from '@/src/shared/components/loading';
import CanvasSelectComponent from './CanvasSelectComponent';
import ModeSelectRow from './ModeSelectRow';
import {
  COLOR_RAMP_DEFINITIONS,
  ColorRampName,
} from '../../../symbology/colorRampUtils';
interface IColorRampProps {
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

export type ColorRampOptions = {
  selectedRamp: string;
  numberOfShades: string;
  selectedMode: string;
};

const ColorRamp: React.FC<IColorRampProps> = ({
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

  const rampType =
    COLOR_RAMP_DEFINITIONS[selectedRamp as ColorRampName]?.type || 'Unknown';

  return (
    <div className="jp-gis-color-ramp-container">
      {showRampSelector && (
        <div className="jp-gis-symbology-row">
          <label htmlFor="color-ramp-select">Color Ramp:</label>
          <CanvasSelectComponent
            selectedRamp={selectedRamp}
            setSelected={setSelectedRamp}
          />
          {selectedRamp && (
            <div className="jp-gis-ramp-type ml-auto">
              <span className="jp-gis-ramp-type-label">
                Color Ramp Type: {rampType}
              </span>
            </div>
          )}
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

export default ColorRamp;
