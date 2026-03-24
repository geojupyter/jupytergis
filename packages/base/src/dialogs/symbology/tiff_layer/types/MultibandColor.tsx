import { IWebGlLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useState } from 'react';

import useGetBandInfo from '@/src/dialogs/symbology/hooks/useGetBandInfo';
import { useOkSignal } from '@/src/dialogs/symbology/hooks/useOkSignal';
import { ISymbologyDialogProps } from '@/src/dialogs/symbology/symbologyDialog';
import {
  saveSymbology,
  WebGlSymbologyParams,
} from '@/src/dialogs/symbology/symbologyUtils';
import BandRow from '@/src/dialogs/symbology/tiff_layer/components/BandRow';
import { LoadingOverlay } from '@/src/shared/components/loading';
import { useLatest } from '@/src/shared/hooks/useLatest';
import { useEffectiveSymbologyParams } from '../../hooks/useEffectiveSymbologyParams';

interface ISelectedBands {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

type rgbEnum = keyof ISelectedBands;

const MultibandColor: React.FC<ISymbologyDialogProps> = ({
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

  const params = useEffectiveSymbologyParams<WebGlSymbologyParams>({
    model,
    layerId: layerId,
    layer,
    isStorySegmentOverride,
    segmentId,
  });

  if (!params || !layer) {
    return;
  }

  const { bandRows, setBandRows, loading } = useGetBandInfo(model, layer);

  const [selectedBands, setSelectedBands] = useState<ISelectedBands>({
    red: 1,
    green: 2,
    blue: 3,
    alpha: 4,
  });

  const numOfBandsRef = useLatest(bandRows.length);
  const selectedBandsRef = useLatest(selectedBands);

  useEffect(() => {
    populateOptions();
  }, []);

  const populateOptions = async () => {
    const layerParams = params as IWebGlLayer;
    const red = layerParams.symbologyState?.redBand ?? 1;
    const green = layerParams.symbologyState?.greenBand ?? 2;
    const blue = layerParams.symbologyState?.blueBand ?? 3;
    const alpha = layerParams.symbologyState?.alphaBand ?? 4;

    setSelectedBands({ red, green, blue, alpha });
  };

  const updateBand = (color: rgbEnum, value: number) => {
    setSelectedBands(prevBands => ({
      ...prevBands,
      [color]: value,
    }));
  };

  const handleOk = () => {
    const colorExpr: ExpressionValue[] = ['array'];
    const colors: (keyof ISelectedBands)[] = ['red', 'green', 'blue'];

    colors.forEach(color => {
      const bandValue = selectedBandsRef.current[color];
      colorExpr.push(bandValue !== 0 ? ['band', bandValue] : 0);
    });

    // Push alpha if selected, else default to 0
    if (selectedBandsRef.current.alpha) {
      colorExpr.push(['band', selectedBandsRef.current.alpha]);
    } else {
      colorExpr.push(['band', numOfBandsRef.current + 1]);
    }

    const symbologyState = {
      renderType: 'Multiband Color',
      redBand: selectedBandsRef.current.red,
      greenBand: selectedBandsRef.current.green,
      blueBand: selectedBandsRef.current.blue,
      alphaBand: selectedBandsRef.current.alpha,
    };

    saveSymbology({
      model,
      layerId,
      isStorySegmentOverride,
      segmentId,
      payload: {
        symbologyState,
        color: colorExpr,
      },
      mutateLayerBeforeSave: targetLayer => {
        targetLayer.type = 'WebGlLayer';
      },
    });
  };

  useOkSignal(okSignalPromise, handleOk);

  return (
    <div className="jp-gis-layer-symbology-container">
      <div className="jp-gis-band-container">
        <LoadingOverlay loading={loading} />
        <BandRow
          label="Red Band"
          index={selectedBands.red - 1} // IMPORTANT: Bands are 1-indexed
          bandRow={bandRows[selectedBands.red - 1]}
          bandRows={bandRows}
          setSelectedBand={val => updateBand('red', val >= 0 ? val : 0)}
          setBandRows={setBandRows}
          isMultibandColor={true}
        />

        <BandRow
          label="Green Band"
          index={selectedBands.green - 1}
          bandRow={bandRows[selectedBands.green - 1]}
          bandRows={bandRows}
          setSelectedBand={val => updateBand('green', val >= 0 ? val : 0)}
          setBandRows={setBandRows}
          isMultibandColor={true}
        />

        <BandRow
          label="Blue Band"
          index={selectedBands.blue - 1}
          bandRow={bandRows[selectedBands.blue - 1]}
          bandRows={bandRows}
          setSelectedBand={val => updateBand('blue', val >= 0 ? val : 0)}
          setBandRows={setBandRows}
          isMultibandColor={true}
        />

        <BandRow
          label="Alpha Band"
          index={selectedBands.alpha - 1}
          bandRow={bandRows[selectedBands.alpha - 1]}
          bandRows={bandRows}
          setSelectedBand={val => updateBand('alpha', val >= 0 ? val : 0)}
          setBandRows={setBandRows}
          isMultibandColor={true}
        />
      </div>
    </div>
  );
};

export default MultibandColor;
