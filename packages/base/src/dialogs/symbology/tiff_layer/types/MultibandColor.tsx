import { IWebGlLayer } from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';
import { Spinner } from '../../../../mainview/spinner';
import useGetBandInfo from '../../hooks/useGetBandInfo';
import { ISymbologyDialogProps } from '../../symbologyDialog';
import BandRow from '../components/BandRow';

interface ISelectedBands {
  red: number;
  green: number;
  blue: number;
}

type rgbEnum = 'red' | 'green' | 'blue';

const MultibandColor = ({
  context,
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

  const { bandRows, setBandRows, loading } = useGetBandInfo(context, layer);

  const [selectedBands, setSelectedBands] = useState<ISelectedBands>({
    red: 1,
    green: 2,
    blue: 3
  });

  const selectedBandsRef = useRef<ISelectedBands>({
    red: selectedBands.red,
    green: selectedBands.green,
    blue: selectedBands.blue
  });

  useEffect(() => {
    populateOptions();

    okSignalPromise.promise.then(okSignal => {
      okSignal.connect(handleOk);
    });

    return () => {
      okSignalPromise.promise.then(okSignal => {
        okSignal.disconnect(handleOk, this);
      });
    };
  }, []);

  const populateOptions = async () => {
    const layerParams = layer.parameters as IWebGlLayer;
    const red = layerParams.symbologyState?.redBand ?? 1;
    const green = layerParams.symbologyState?.greenBand ?? 2;
    const blue = layerParams.symbologyState?.blueBand ?? 3;

    setSelectedBands({ red, green, blue });
  };

  useEffect(() => {
    selectedBandsRef.current = selectedBands;
  }, [selectedBands]);

  const updateBand = (color: rgbEnum, value: number) => {
    setSelectedBands(prevBands => ({
      ...prevBands,
      [color]: value
    }));
  };

  const handleOk = () => {
    // Update layer
    if (!layer.parameters) {
      return;
    }

    const colorExpr: ExpressionValue[] = ['array'];
    const rgb: rgbEnum[] = ['red', 'green', 'blue'];

    rgb.forEach(color => {
      const bandValue = selectedBandsRef.current[color];
      colorExpr.push(bandValue !== 0 ? ['band', bandValue] : 0);
    });

    // Array expression expects 4 values
    colorExpr.push(['band', 5]);

    const symbologyState = {
      renderType: 'Multiband Color',
      redBand: selectedBandsRef.current['red'],
      greenBand: selectedBandsRef.current['green'],
      blueBand: selectedBandsRef.current['blue']
    };

    layer.parameters.symbologyState = symbologyState;
    layer.parameters.color = colorExpr;

    context.model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  return (
    <div className="jp-gis-layer-symbology-container">
      <div className="jp-gis-band-container">
        {loading ? (
          <Spinner loading={loading} />
        ) : (
          <>
            <BandRow
              label="Red Band"
              index={selectedBands['red'] - 1}
              bandRow={bandRows[selectedBands['red'] - 1]}
              bandRows={bandRows}
              setSelectedBand={val => updateBand('red', val)}
              setBandRows={setBandRows}
              isMultibandColor={true}
            />

            <BandRow
              label="Green Band"
              index={selectedBands['green'] - 1}
              bandRow={bandRows[selectedBands['green'] - 1]}
              bandRows={bandRows}
              setSelectedBand={val => updateBand('green', val)}
              setBandRows={setBandRows}
              isMultibandColor={true}
            />

            <BandRow
              label="Blue Band"
              index={selectedBands['blue'] - 1}
              bandRow={bandRows[selectedBands['blue'] - 1]}
              bandRows={bandRows}
              setSelectedBand={val => updateBand('blue', val)}
              setBandRows={setBandRows}
              isMultibandColor={true}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default MultibandColor;
