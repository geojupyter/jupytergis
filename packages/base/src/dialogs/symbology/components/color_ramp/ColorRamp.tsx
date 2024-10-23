import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useState } from 'react';
import CanvasSelectComponent from './CanvasSelectComponent';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ModeSelectRow from './ModeSelectRow';
import { IDict } from '@jupytergis/schema';

interface IColorRampProps {
  modeOptions: string[];
  layerParams: IDict;
  classifyFunc: (
    selectedMode: string,
    numberOfShades: string,
    selectedRamp: string,
    setIsLoading: (isLoading: boolean) => void
  ) => void;
  showModeRow: boolean;
}

export type ColorRampOptions = {
  selectedRamp: string;
  numberOfShades: string;
  selectedMode: string;
};

const ColorRamp = ({
  layerParams,
  modeOptions,
  classifyFunc,
  showModeRow
}: IColorRampProps) => {
  const [selectedRamp, setSelectedRamp] = useState('');
  const [selectedMode, setSelectedMode] = useState('');
  const [numberOfShades, setNumberOfShades] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    populateOptions();
  }, []);

  const populateOptions = async () => {
    let nClasses, singleBandMode, colorRamp;

    if (layerParams.symbologyState) {
      nClasses = layerParams.symbologyState.nClasses;
      singleBandMode = layerParams.symbologyState.mode;
      colorRamp = layerParams.symbologyState.colorRamp;
    }
    setNumberOfShades(nClasses ? nClasses : '9');
    setSelectedMode(singleBandMode ? singleBandMode : 'equal interval');
    setSelectedRamp(colorRamp ? colorRamp : 'cool');
  };

  return (
    <div className="jp-gis-color-ramp-container">
      <div className="jp-gis-symbology-row">
        <label htmlFor="color-ramp-select">Color Ramp:</label>
        <CanvasSelectComponent
          selectedRamp={selectedRamp}
          setSelected={setSelectedRamp}
        />
      </div>
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
        <FontAwesomeIcon icon={faSpinner} className="jp-gis-loading-spinner" />
      ) : (
        <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          onClick={() =>
            classifyFunc(
              selectedMode,
              numberOfShades,
              selectedRamp,
              setIsLoading
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
