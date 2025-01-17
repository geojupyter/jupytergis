import React, { useEffect, useRef, useState } from 'react';
import { ISymbologyDialogProps } from '../../symbologyDialog';
import BandRow from '../components/BandRow';
import { IBandRow, TifBandData } from './SingleBandPseudoColor';
import { IWebGlLayer } from '@jupytergis/schema';
import { loadGeoTIFFWithCache } from '../../../../tools';
import { Spinner } from '../../../../mainview/spinner';
import { ExpressionValue } from 'ol/expr/expression';

interface ISelectedBands {
  red: number;
  green: number;
  blue: number;
}

const MultibandColor = ({
  context,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
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

  const [bandRows, setBandRows] = useState<IBandRow[]>([]);

  if (!layerId) {
    return;
  }
  const layer = context.model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  useEffect(() => {
    populateOptions();
    getBandInfo();

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

  const preloadGeoTiffFile = async (sourceInfo: {
    url?: string | undefined;
  }) => {
    return await loadGeoTIFFWithCache(sourceInfo);
  };

  const getBandInfo = async () => {
    const bandsArr: IBandRow[] = [];
    const source = context.model.getSource(layer?.parameters?.source);
    const sourceInfo = source?.parameters?.urls[0];

    if (!sourceInfo?.url) {
      return;
    }

    // Preload the file only once
    const preloadedFile = await preloadGeoTiffFile(sourceInfo);
    const { file, metadata, sourceUrl } = { ...preloadedFile };

    if (file && metadata && sourceUrl === sourceInfo.url) {
      metadata['bands'].forEach((bandData: TifBandData) => {
        bandsArr.push({
          band: bandData.band,
          colorInterpretation: bandData.colorInterpretation,
          stats: {
            minimum: sourceInfo.min ?? bandData.minimum,
            maximum: sourceInfo.max ?? bandData.maximum,
            mean: bandData.mean,
            stdDev: bandData.stdDev
          },
          metadata: bandData.metadata,
          histogram: bandData.histogram
        });
      });
      setBandRows(bandsArr);
    }
  };

  const updateBand = (color: 'red' | 'green' | 'blue', value: number) => {
    setSelectedBands(prevBands => ({
      ...prevBands,
      [color]: value
    }));
    selectedBandsRef.current[color] = value;
    console.log('updateing', value);
  };

  const handleOk = () => {
    // Update layer
    if (!layer.parameters) {
      return;
    }

    const colorExpr: ExpressionValue[] = ['array'];

    console.log('selectedBandsRef.current', selectedBandsRef.current);
    // Set NoData values to transparent
    colorExpr.push(['band', selectedBandsRef.current['red']]);
    colorExpr.push(['band', selectedBandsRef.current['green']]);
    colorExpr.push(['band', selectedBandsRef.current['blue']]);
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
        {bandRows.length === 0 ? (
          <Spinner loading={bandRows.length === 0} />
        ) : (
          <>
            <BandRow
              label="Red Band"
              index={selectedBands['red'] - 1}
              bandRow={bandRows[selectedBands['red'] - 1]}
              bandRows={bandRows}
              setSelectedBand={val => updateBand('red', val)}
              setBandRows={setBandRows}
              hideMinMax={true}
            />

            <BandRow
              label="Green Band"
              index={selectedBands['green'] - 1}
              bandRow={bandRows[selectedBands['green'] - 1]}
              bandRows={bandRows}
              setSelectedBand={val => updateBand('green', val)}
              setBandRows={setBandRows}
              hideMinMax={true}
            />

            <BandRow
              label="Blue Band"
              index={selectedBands['blue'] - 1}
              bandRow={bandRows[selectedBands['blue'] - 1]}
              bandRows={bandRows}
              setSelectedBand={val => updateBand('blue', val)}
              setBandRows={setBandRows}
              hideMinMax={true}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default MultibandColor;
