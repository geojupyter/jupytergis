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
  if (!layerId) {
    return;
  }
  const layer = context.model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }
  const [selectedRamp, setSelectedRamp] = useState('');
  const [heatmapOptions, setHetamapOptions] = useState({
    radius: 8,
    blur: 15
  });
  const selectedRampRef = useRef('cool');
  const heatmapOptionsRef = useRef({
    radius: 8,
    blur: 15
  });

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
  }, [selectedRamp, heatmapOptions]);

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
    layer.parameters.blur = heatmapOptionsRef.current.blur;
    layer.parameters.radius = heatmapOptionsRef.current.radius;
    layer.type = 'HeatmapLayer';

    context.model.sharedModel.updateLayer(layerId, layer);

    cancel();
  };

  return (
    <div className="jp-gis-layer-symbology-container">
      <div className="jp-gis-symbology-row jp-gis-heatmap">
        <label htmlFor="color-ramp-select">Color Ramp:</label>
        <CanvasSelectComponent
          selectedRamp={selectedRamp}
          setSelected={setSelectedRamp}
        />
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
              radius: +event.target.value
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
              blur: +event.target.value
            }))
          }
        />
      </div>
    </div>
  );
};

export default Heatmap;
