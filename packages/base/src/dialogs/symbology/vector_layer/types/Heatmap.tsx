import colormap from 'colormap';
import React, { useEffect, useRef, useState } from 'react';
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
  const selectedRampRef = useRef('cool');

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

  useEffect(() => {
    selectedRampRef.current = selectedRamp;
  }, [selectedRamp]);

  const populateOptions = async () => {
    let colorRamp;

    if (layer.parameters?.symbologyState) {
      colorRamp = layer.parameters.symbologyState.colorRamp;
    }

    setSelectedRamp(colorRamp ? colorRamp : 'cool');
  };

  const handleOk = () => {
    if (!layer.parameters) {
      return;
    }

    const colorMap = colormap({
      colormap: selectedRampRef.current,
      nshades: 9,
      format: 'hex'
    });

    const symbologyState = {
      renderType: 'Heatmap',
      colorRamp: selectedRampRef.current
    };

    layer.parameters.symbologyState = symbologyState;
    layer.parameters.color = colorMap;

    context.model.sharedModel.updateLayer(layerId, layer);

    cancel();
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
