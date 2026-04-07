import colormap from 'colormap';
import React, { useEffect, useState } from 'react';

import ColorRampSelector from '@/src/features/layers/symbology/components/color_ramp/ColorRampSelector';
import { useOkSignal } from '@/src/features/layers/symbology/hooks/useOkSignal';
import { ISymbologyDialogProps } from '@/src/features/layers/symbology/symbologyDialog';
import {
  saveSymbology,
  VectorSymbologyParams,
} from '@/src/features/layers/symbology/symbologyUtils';
import { useLatest } from '@/src/shared/hooks/useLatest';
import {
  ColorRampName,
  IColorMap,
  useColorMapList,
  COLOR_RAMP_DEFAULTS,
} from '../../colorRampUtils';
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
  const [reverseRamp, setReverseRamp] = useState<boolean>(false);
  const [colorMaps, setColorMaps] = useState<IColorMap[]>([]);

  const selectedRampRef = useLatest(selectedRamp);
  const heatmapOptionsRef = useLatest(heatmapOptions);
  const reverseRampRef = useLatest(reverseRamp);

  useColorMapList(setColorMaps);

  // Filter: only continuous colormaps with class requirement <= 9 nshades
  // because heatmap does not support nshades > 9
  const continuousMaps = colorMaps.filter(m => {
    if (m.type !== 'continuous') {
      return false;
    }
    const minShades = COLOR_RAMP_DEFAULTS[m.name];
    return !minShades || minShades <= 9;
  });

  useEffect(() => {
    populateOptions();
  }, []);

  const populateOptions = async () => {
    let colorRamp: ColorRampName = 'viridis';

    if (params.symbologyState?.colorRamp) {
      colorRamp = params.symbologyState.colorRamp as ColorRampName;
    }

    if (typeof params.symbologyState?.reverseRamp === 'boolean') {
      setReverseRamp(params.symbologyState.reverseRamp);
    }

    setSelectedRamp(colorRamp);
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

    // The Heatmap dialog converts a vector layer to a heatmap layer via
    // mutateLayerBeforeSave; the symbologyState it writes is structurally
    // a heatmap state (renderType: 'Heatmap', with a gradient array) but
    // needs to be accepted on VectorSymbologyParams here, hence the cast.
    const symbologyState = {
      renderType: 'Heatmap',
      colorRamp: selectedRampRef.current,
      reverseRamp: reverseRampRef.current,
      gradient: colorMap,
    } as unknown as VectorSymbologyParams['symbologyState'];

    saveSymbology({
      model,
      layerId,
      isStorySegmentOverride,
      segmentId,
      payload: {
        symbologyState,
      },
      mutateLayerBeforeSave: targetLayer => {
        targetLayer.parameters.blur = heatmapOptionsRef.current.blur;
        targetLayer.parameters.radius = heatmapOptionsRef.current.radius;
        targetLayer.type = 'HeatmapLayer';
        if (targetLayer.parameters?.color !== undefined) {
          delete targetLayer.parameters.color;
        }
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
          colorMaps={continuousMaps}
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
