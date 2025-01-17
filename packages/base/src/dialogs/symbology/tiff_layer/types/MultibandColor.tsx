import React, { useEffect, useRef, useState } from 'react';
import { ISymbologyDialogProps } from '../../symbologyDialog';
import BandRow from '../components/BandRow';
import { IBandRow, TifBandData } from './SingleBandPseudoColor';
import { IWebGlLayer } from '@jupytergis/schema';
import { loadGeoTIFFWithCache } from '../../../../tools';
import { Spinner } from '../../../../mainview/spinner';
import { ExpressionValue } from 'ol/expr/expression';

const MultibandColor = ({
  context,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const [selectedRedBand, setSelectedRedBand] = useState(1);
  const [selectedGreenBand, setSelectedGreenBand] = useState(2);
  const [selectedBlueBand, setSelectedBlueBand] = useState(3);

  const selectedRedBandRef = useRef<number>();
  const selectedGreenBandRef = useRef<number>();
  const selectedBlueBandRef = useRef<number>();

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

  useEffect(() => {
    selectedRedBandRef.current = selectedRedBand;
    selectedGreenBandRef.current = selectedGreenBand;
    selectedBlueBandRef.current = selectedBlueBand;
  }, [selectedRedBand, selectedGreenBand, selectedBlueBand]);

  const populateOptions = async () => {
    const layerParams = layer.parameters as IWebGlLayer;
    const redBand = layerParams.symbologyState?.redBand ?? 1;
    const greenBand = layerParams.symbologyState?.greenBand ?? 2;
    const blueBand = layerParams.symbologyState?.blueBand ?? 3;

    setSelectedRedBand(redBand);
    setSelectedGreenBand(greenBand);
    setSelectedBlueBand(blueBand);
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

  const handleOk = () => {
    // Update layer
    if (!layer.parameters) {
      return;
    }

    const colorExpr: ExpressionValue[] = ['array'];

    // Set NoData values to transparent
    colorExpr.push(['band', selectedRedBandRef.current]);
    colorExpr.push(['band', selectedGreenBandRef.current]);
    colorExpr.push(['band', selectedBlueBandRef.current]);
    colorExpr.push(['band', 5]);

    const symbologyState = {
      renderType: 'Multiband Color',
      redBand: selectedRedBandRef.current,
      greenBand: selectedGreenBandRef.current,
      blueBand: selectedBlueBandRef.current
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
              index={selectedRedBand - 1}
              bandRow={bandRows[selectedRedBand - 1]}
              bandRows={bandRows}
              setSelectedBand={setSelectedRedBand}
              setBandRows={setBandRows}
              hideMinMax={true}
            />

            <BandRow
              label="Green Band"
              index={selectedGreenBand - 1}
              bandRow={bandRows[selectedGreenBand - 1]}
              bandRows={bandRows}
              setSelectedBand={setSelectedGreenBand}
              setBandRows={setBandRows}
              hideMinMax={true}
            />

            <BandRow
              label="Blue Band"
              index={selectedBlueBand - 1}
              bandRow={bandRows[selectedBlueBand - 1]}
              bandRows={bandRows}
              setSelectedBand={setSelectedBlueBand}
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
