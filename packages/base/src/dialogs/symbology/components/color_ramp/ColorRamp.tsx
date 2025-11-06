import { IDict } from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useState } from 'react';

import { LoadingIcon } from '@/src/shared/components/loading';
import CanvasSelectComponent from './CanvasSelectComponent';
import ModeSelectRow from './ModeSelectRow';
import { COLOR_RAMP_DEFAULTS, ColorRampName } from '../../colorRampUtils';

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
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (selectedRamp === '' && selectedMode === '' && numberOfShades === '') {
      populateOptions();
    }
  }, [layerParams]);

  useEffect(() => {
    if (!selectedRamp) {
      return;
    }

    const defaultClasses =
      COLOR_RAMP_DEFAULTS[selectedRamp as ColorRampName] ?? 9;

    setNumberOfShades(defaultClasses.toString());
    setWarning(null);
  }, [selectedRamp]);

  useEffect(() => {
    if (!selectedRamp || !numberOfShades) {
      return;
    }

    const minRequired = COLOR_RAMP_DEFAULTS[selectedRamp as ColorRampName];
    const shades = parseInt(numberOfShades, 10);
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
    let nClasses, singleBandMode, colorRamp;

    if (layerParams.symbologyState) {
      nClasses = layerParams.symbologyState.nClasses;
      singleBandMode = layerParams.symbologyState.mode;
      colorRamp = layerParams.symbologyState.colorRamp;
    }
    const defaultRamp = colorRamp ? colorRamp : 'viridis';
    const defaultClasses =
      nClasses ?? COLOR_RAMP_DEFAULTS[defaultRamp as ColorRampName] ?? 9;

    setNumberOfShades(defaultClasses.toString());
    setSelectedMode(singleBandMode ? singleBandMode : 'equal interval');
    setSelectedRamp(defaultRamp);
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
          disabled={!!warning}
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
