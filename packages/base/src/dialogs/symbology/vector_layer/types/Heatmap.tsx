import colormap from 'colormap';
import React, { useEffect, useState } from 'react';

import ColorRampSelector from '@/src/dialogs/symbology/components/color_ramp/ColorRampSelector';
import { useOkSignal } from '@/src/dialogs/symbology/hooks/useOkSignal';
import { ISymbologyDialogProps } from '@/src/dialogs/symbology/symbologyDialog';
import {
  saveSymbology,
  VectorSymbologyParams,
} from '@/src/dialogs/symbology/symbologyUtils';
import { useLatest } from '@/src/shared/hooks/useLatest';
import { ColorRampName } from '@/src/types';
import { useEffectiveSymbologyParams } from '../../hooks/useEffectiveSymbologyParams';

const Heatmap: React.FC<ISymbologyDialogProps> = ({
  model,
  okSignalPromise,
  layerId,
  isStorySegmentOverride,
  segmentId,
}) => {
  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);

  const params = useEffectiveSymbologyParams<VectorSymbologyParams>({
    model,
    layerId: layerId,
    layer,
    isStorySegmentOverride,
    segmentId,
  });

  if (!params) {
    return;
  }

  const [selectedRamp, setSelectedRamp] = useState<ColorRampName>('viridis');
  const [heatmapOptions, setHetamapOptions] = useState({
    radius: 8,
    blur: 15,
  });
  const [reverseRamp, setReverseRamp] = useState(false);

  const selectedRampRef = useLatest(selectedRamp);
  const heatmapOptionsRef = useLatest(heatmapOptions);
  const reverseRampRef = useLatest(reverseRamp);

  useEffect(() => {
    populateOptions();
  }, []);

  const populateOptions = async () => {
    let colorRamp;

    if (params.symbologyState?.colorRamp) {
      colorRamp = params.symbologyState.colorRamp as ColorRampName;
    }

    setSelectedRamp(colorRamp ? colorRamp : 'viridis');
  };

  const handleOk = () => {
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

    saveSymbology({
      model,
      layerId,
      isStorySegmentOverride,
      segmentId,
      payload: {
        symbologyState,
        color: colorMap,
      },
      mutateLayerBeforeSave: targetLayer => {
        targetLayer.parameters.blur = heatmapOptionsRef.current.blur;
        targetLayer.parameters.radius = heatmapOptionsRef.current.radius;
        targetLayer.type = 'HeatmapLayer';
      },
    });
  };

  useOkSignal(okSignalPromise, handleOk);

  return (
    <div className="jp-gis-layer-symbology-container">
      <p>Represent features based on their density using a heatmap.</p>
      <div className="jp-gis-symbology-row jp-gis-heatmap">
        <label htmlFor="color-ramp-select">Color Ramp:</label>
        <ColorRampSelector
          selectedRamp={selectedRamp}
          setSelected={setSelectedRamp}
          reverse={reverseRamp}
          setReverse={setReverseRamp}
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
