import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { fromUrl, fromBlob } from 'geotiff';
import { useEffect, useState } from 'react';

import { loadFile } from '@/src/tools';

export interface IBandRow {
  band: number;
  colorInterpretation?: string;
  stats: {
    minimum: number;
    maximum: number;
  };
}

const useGetSingleBandInfo = (
  model: IJupyterGISModel,
  layer: IJGISLayer,
  layerId: string,
  selectedBand: number,
) => {
  const [bandRows, setBandRows] = useState<IBandRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBandInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const bandsArr: IBandRow[] = [];
      const source = model.getSource(layer?.parameters?.source);
      const sourceInfo = source?.parameters?.urls[0];

      if (!sourceInfo?.url) {
        setError('No source URL found.');
        setLoading(false);
        return;
      }

      let tiff;
      if (
        sourceInfo.url.startsWith('http') ||
        sourceInfo.url.startsWith('https')
      ) {
        // Handle remote GeoTIFF file
        tiff = await fromUrl(sourceInfo.url);
      } else {
        // Handle local GeoTIFF file
        const preloadedFile = await loadFile({
          filepath: sourceInfo.url,
          type: 'GeoTiffSource',
          model,
        });

        if (!preloadedFile.file) {
          setError('Failed to load local file.');
          setLoading(false);
          return;
        }

        tiff = await fromBlob(preloadedFile.file);
      }

      const image = await tiff.getImage();
      const numberOfBands = image.getSamplesPerPixel();

      // 1. Try metadata first
      let dataMin = image.fileDirectory.STATISTICS_MINIMUM;
      let dataMax = image.fileDirectory.STATISTICS_MAXIMUM;

      if (dataMin === undefined || dataMax === undefined) {
        // 2. Try smallest overview if available
        const overviewCount = await tiff.getImageCount();
        const targetImage =
          overviewCount > 1 ? await tiff.getImage(overviewCount - 1) : image;

        // 3. Read downsampled raster (fast)
        const rasters = await targetImage.readRasters();
        dataMin = Infinity;
        dataMax = -Infinity;

        const bandIndex = selectedBand - 1;
        const bandData = rasters[bandIndex] as
          | Float32Array
          | Uint16Array
          | Int16Array;
        if (bandData) {
          for (let j = 0; j < bandData.length; j++) {
            const val = bandData[j];
            if (val < dataMin) {
              dataMin = val;
            }
            if (val > dataMax) {
              dataMax = val;
            }
          }
        }
      }

      model.sharedModel.updateLayer(layerId, {
        ...layer,
        parameters: {
          ...layer.parameters,
          symbologyState: {
            ...(layer.parameters?.symbologyState ?? {}),
            dataMin,
            dataMax,
            band: selectedBand,
          },
        },
      });

      console.debug(`[Symbology Init] Final Min=${dataMin}, Max=${dataMax}`);

      for (let i = 0; i < numberOfBands; i++) {
        bandsArr.push({
          band: i + 1,
          stats: {
            minimum: dataMin ?? 0,
            maximum: dataMax ?? 100,
          },
        });
      }

      setBandRows(bandsArr);
    } catch (err: any) {
      console.error(err);
      setError(`Error fetching band info: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBandInfo();
  }, [selectedBand]);

  return { bandRows, loading, error };
};

export default useGetSingleBandInfo;
