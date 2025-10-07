import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { fromUrl, fromBlob } from 'geotiff';
import { useEffect, useState } from 'react';

import { loadFile } from '@/src/tools';

export interface IBandHistogram {
  buckets: number[];
  count: number;
  max: number;
  min: number;
}

export interface IBandRow {
  band: number;
  colorInterpretation?: string;
  stats: {
    minimum: number;
    maximum: number;
  };
}

const useGetBandInfo = (model: IJupyterGISModel, layer: IJGISLayer) => {
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

      let min = layer.parameters?.symbologyState?.min;
      let max = layer.parameters?.symbologyState?.max;

      if (min === undefined || max === undefined) {
        // 1. Try metadata first
        let dataMin = image.fileDirectory.STATISTICS_MINIMUM;
        let dataMax = image.fileDirectory.STATISTICS_MAXIMUM;

        if (dataMin === undefined || dataMax === undefined) {
          // 2. Try smallest overview if available
          const overviewCount = await tiff.getImageCount();
          const targetImage =
            overviewCount > 1 ? await tiff.getImage(overviewCount - 1) : image;

          // 3. Read a downsampled raster (fast)
          const rasters = await targetImage.readRasters({
            width: 256,
            height: 256,
            resampleMethod: 'nearest',
          });

          dataMin = Infinity;
          dataMax = -Infinity;

          for (let i = 0; i < rasters.length; i++) {
            const bandData = rasters[i] as
              | Float32Array
              | Uint16Array
              | Int16Array;
            for (let j = 0; j < bandData.length; j++) {
              if (bandData[j] < dataMin) {
                dataMin = bandData[j];
              }
              if (bandData[j] > dataMax) {
                dataMax = bandData[j];
              }
            }
          }
        }

        min = dataMin;
        max = dataMax;

        layer.parameters = {
          ...layer.parameters,
          symbologyState: {
            ...(layer.parameters?.symbologyState ?? {}),
            min,
            max,
          },
        };

        sourceInfo.min = min;
        sourceInfo.max = max;

        console.log(`[Symbology Init] Final Min=${min}, Max=${max}`);
      } else {
        sourceInfo.min = min;
        sourceInfo.max = max;
      }

      for (let i = 0; i < numberOfBands; i++) {
        bandsArr.push({
          band: i,
          stats: {
            minimum: min ?? 0,
            maximum: max ?? 100,
          },
        });
      }

      setBandRows(bandsArr);
    } catch (err: any) {
      setError(`Error fetching band info: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBandInfo();
  }, []);

  return { bandRows, setBandRows, loading, error };
};

export default useGetBandInfo;
