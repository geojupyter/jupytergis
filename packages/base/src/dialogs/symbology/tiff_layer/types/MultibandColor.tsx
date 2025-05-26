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
  alpha: number;
}

type rgbEnum = keyof ISelectedBands;

const MultibandColor = ({
  model,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  const { bandRows, setBandRows, loading } = useGetBandInfo(model, layer);

  const [selectedBands, setSelectedBands] = useState<ISelectedBands>({
    red: 1,
    green: 2,
    blue: 3,
    alpha: 4
  });

  const numOfBandsRef = useRef(0);
  const selectedBandsRef = useRef<ISelectedBands>({
    red: selectedBands.red,
    green: selectedBands.green,
    blue: selectedBands.blue,
    alpha: selectedBands.alpha
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

  useEffect(() => {
    numOfBandsRef.current = bandRows.length;
  }, [bandRows]);

  useEffect(() => {
    selectedBandsRef.current = selectedBands;
  }, [selectedBands]);

  const populateOptions = async () => {
    const layerParams = layer.parameters as IWebGlLayer;
    const red = layerParams.symbologyState?.redBand ?? 1;
    const green = layerParams.symbologyState?.greenBand ?? 2;
    const blue = layerParams.symbologyState?.blueBand ?? 3;
    const alpha = layerParams.symbologyState?.alphaBand ?? 4;

    setSelectedBands({ red, green, blue, alpha });
  };

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
    const colors: (keyof ISelectedBands)[] = ['red', 'green', 'blue'];

    colors.forEach(color => {
      const bandValue = selectedBandsRef.current[color];
      colorExpr.push(bandValue !== 0 ? ['band', bandValue] : 0);
    });

    // Push alpha if selected, else default to 255
    if (selectedBandsRef.current.alpha) {
      colorExpr.push(['band', selectedBandsRef.current.alpha]);
    } else {
      colorExpr.push(255); // full opacity fallback
    }

    const symbologyState = {
      renderType: 'Multiband Color',
      redBand: selectedBandsRef.current.red,
      greenBand: selectedBandsRef.current.green,
      blueBand: selectedBandsRef.current.blue,
      alphaBand: selectedBandsRef.current.alpha
    };

    layer.parameters.symbologyState = symbologyState;
    layer.parameters.color = colorExpr;
    layer.type = 'WebGlLayer';

    model.sharedModel.updateLayer(layerId, layer);
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
              index={selectedBands.red - 1}
              bandRow={bandRows[selectedBands.red - 1]}
              bandRows={bandRows}
              setSelectedBand={val => updateBand('red', val > 0 ? val + 1 : 0)}
              setBandRows={setBandRows}
              isMultibandColor={true}
            />

            <BandRow
              label="Green Band"
              index={selectedBands.green - 1}
              bandRow={bandRows[selectedBands.green - 1]}
              bandRows={bandRows}
              setSelectedBand={val => updateBand('green', val > 0 ? val + 1 : 0)}
              setBandRows={setBandRows}
              isMultibandColor={true}
            />

            <BandRow
              label="Blue Band"
              index={selectedBands.blue - 1}
              bandRow={bandRows[selectedBands.blue - 1]}
              bandRows={bandRows}
              setSelectedBand={val => updateBand('blue', val > 0 ? val + 1 : 0)}
              setBandRows={setBandRows}
              isMultibandColor={true}
            />

            <BandRow
              label="Alpha Band"
              index={selectedBands.alpha - 1}
              bandRow={bandRows[selectedBands.alpha - 1]}
              bandRows={bandRows}
              setSelectedBand={val => updateBand('alpha', val > 0 ? val + 1 : 0)}
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
