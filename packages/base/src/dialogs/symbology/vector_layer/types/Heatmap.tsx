import colormap from 'colormap';
import React, { useEffect, useState } from 'react';
import CanvasSelectComponent from '../../components/color_ramp/CanvasSelectComponent';
import { ISymbologyDialogProps } from '../../symbologyDialog';

const Heatmap = ({
  context,
  state,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const [selectedRamp, setSelectedRamp] = useState('');

  if (!layerId) {
    return;
  }
  const layer = context.model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  useEffect(() => {
    populateOptions();

    okSignalPromise.promise.then(okSignal => {
      okSignal.connect(handleOk, this);
    });

    return () => {
      okSignalPromise.promise.then(okSignal => {
        okSignal.disconnect(handleOk, this);
      });
    };
  }, []);

  const populateOptions = async () => {
    let colorRamp;

    if (layer.parameters?.symbologyState) {
      colorRamp = layer.parameters?.symbologyState.colorRamp;
    }

    setSelectedRamp(colorRamp ? colorRamp : 'cool');
  };

  const buildColorInfoFromClassification = (selectedRamp: string) => {
    console.log('buikld');
  };

  const handleOk = () => {
    const colorMap1 = colormap({
      colormap: selectedRamp,
      nshades: 9,
      format: 'rgba'
    });

    const colorMap2 = colormap({
      colormap: selectedRamp,
      nshades: 9,
      format: 'float'
    });

    const colorMap3 = colormap({
      colormap: selectedRamp,
      nshades: 9,
      format: 'hex'
    });

    const colorMap4 = colormap({
      colormap: selectedRamp,
      nshades: 9,
      format: 'rgbaString'
    });
    console.log('ok', colorMap1);
    console.log('ok2', colorMap2);
    console.log('ok3', colorMap3);
    console.log('ok4', colorMap4);
  };

  return (
    <div className="jp-gis-layer-symbology-container" style={{ height: 400 }}>
      <div className="jp-gis-color-ramp-container">
        <div className="jp-gis-symbology-row">
          <label htmlFor="color-ramp-select">Color Ramp:</label>
          <CanvasSelectComponent
            selectedRamp={selectedRamp}
            setSelected={setSelectedRamp}
          />
        </div>
      </div>
    </div>
  );
};

export default Heatmap;
