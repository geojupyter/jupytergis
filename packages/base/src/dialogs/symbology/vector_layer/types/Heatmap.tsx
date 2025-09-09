import colormap from 'colormap';
import React, { useEffect, useRef, useState } from 'react';

import CanvasSelectComponent from '@/src/dialogs/symbology/components/color_ramp/CanvasSelectComponent';
import { ISymbologyDialogProps } from '@/src/dialogs/symbology/symbologyDialog';

const Heatmap: React.FC<ISymbologyDialogProps> = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId,
}) => {
  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }
  const [selectedRamp, setSelectedRamp] = useState('');
  const [heatmapOptions, setHetamapOptions] = useState({
    radius: 8,
    blur: 15,
  });
  const [reverseRamp, setReverseRamp] = useState(false);

  const selectedRampRef = useRef('viridis');
  const heatmapOptionsRef = useRef({
    radius: 8,
    blur: 15,
  });
  const reverseRampRef = useRef(false);

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
    heatmapOptionsRef.current = heatmapOptions;
    reverseRampRef.current = reverseRamp;
  }, [selectedRamp, heatmapOptions, reverseRamp]);

  const populateOptions = async () => {
    let colorRamp;

    if (layer.parameters?.symbologyState) {
      colorRamp = layer.parameters.symbologyState.colorRamp;
    }

    setSelectedRamp(colorRamp ? colorRamp : 'viridis');
  };

  const handleOk = () => {
    if (!layer.parameters) {
      return;
    }

    let colorMap = colormap({
      colormap: selectedRampRef.current,
      nshades: 9,
      format: 'hex',
    });

    if (reverseRampRef.current) {
      colorMap = [...colorMap].reverse();
    }

    const symbologyState = {
      renderType: 'Heatmap',
      colorRamp: selectedRampRef.current,
      reverse: reverseRampRef.current,
    };

    layer.parameters.symbologyState = symbologyState;
    layer.parameters.color = colorMap;
    layer.parameters.blur = heatmapOptionsRef.current.blur;
    layer.parameters.radius = heatmapOptionsRef.current.radius;
    layer.type = 'HeatmapLayer';

    model.sharedModel.updateLayer(layerId, layer);

    cancel();
  };

  return (
    <div className="jp-gis-layer-symbology-container">
      <p>Represent features based on their density using a heatmap.</p>
      <div className="jp-gis-symbology-row jp-gis-heatmap">
        <label htmlFor="color-ramp-select">Color Ramp:</label>
        <CanvasSelectComponent
          selectedRamp={selectedRamp}
          setSelected={setSelectedRamp}
        />
      </div>
      <div className="jp-gis-symbology-row">
        <label>
          <input
            type="checkbox"
            checked={reverseRamp}
            onChange={e => setReverseRamp(e.target.checked)}
          />
          Reverse Color Ramp
        </label>
      </div>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Radius:</label>
        <input
          type="number"
          value={heatmapOptions.radius}
          className="jp-mod-styled"
          onChange={event =>
            setHetamapOptions(prevState => ({
              ...prevState,
              radius: +event.target.value,
            }))
          }
        />
      </div>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Blur:</label>
        <input
          type="number"
          value={heatmapOptions.blur}
          className="jp-mod-styled"
          onChange={event =>
            setHetamapOptions(prevState => ({
              ...prevState,
              blur: +event.target.value,
            }))
          }
        />
      </div>
    </div>
  );
};

export default Heatmap;
