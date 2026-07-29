/* eslint-disable no-console */
import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { fromUrl, fromBlob } from 'geotiff';
import { useEffect, useState } from 'react';

import { loadFile } from '@/src/tools';
import { getBandInfoFromZarr } from '../zarrBandDiscovery';

export interface IBandRow {
  band: number;
  name: string;
  colorInterpretation?: string;
  stats: {
    minimum: number;
    maximum: number;
  };
}

const useGetBandInfo = (
  model: IJupyterGISModel,
  layer: IJGISLayer | null | undefined,
) => {
  const [bandRows, setBandRows] = useState<IBandRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBandInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const source = model.getSource(layer?.parameters?.source);

      if (layer?.type === 'GeoZarrLayer') {
        try {
          const zarrUrl =
            source?.parameters?.url || source?.parameters?.urls?.[0]?.url;

          if (!zarrUrl) {
            throw new Error('No Zarr URL found.');
          }

          const bands = await getBandInfoFromZarr(zarrUrl);

          const bandsArr: IBandRow[] = bands.map(b => ({
            band: b.band,
            name: b.name,
            colorInterpretation: b.colorInterpretation,
            stats: {
              minimum: b.stats.minimum,
              maximum: b.stats.maximum,
            },
          }));

          setBandRows(bandsArr);
        } catch (err: any) {
          console.error('Zarr band fetch failed:', err);
          setError(`Zarr error: ${err.message}`);
        } finally {
          setLoading(false);
        }

        return;
      }

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

      const imageCount = await tiff.getImageCount();
      const image =
        imageCount > 1
          ? await tiff.getImage(imageCount - 1)
          : await tiff.getImage();

      const numberOfBands = image.getSamplesPerPixel();

      const bandsArr: IBandRow[] = [];

      for (let i = 0; i < numberOfBands; i++) {
        // Get min/max from metadata
        const metadata = image.getGDALMetadata?.();

        let min = Infinity;
        let max = -Infinity;

        if (metadata) {
          const m1 = parseFloat(metadata['STATISTICS_MINIMUM']);
          const m2 = parseFloat(metadata['STATISTICS_MAXIMUM']);

          if (!isNaN(m1) && !isNaN(m2)) {
            min = m1;
            max = m2;
          }
          console.log('metadata min/max', min, max);
        }

        // fallback to sampling
        if (min === Infinity || max === -Infinity) {
          const raster = await image.readRasters({
            samples: [i],
            width: 64,
            height: 64,
            resampleMethod: 'nearest',
          });

          if (!Array.isArray(raster)) {
            throw new Error('Expected raster to be an array of TypedArrays');
          }

          const bandData = raster[0];

          min = Infinity;
          max = -Infinity;

          for (let j = 0; j < bandData.length; j++) {
            const val = bandData[j];
            if (val < min) {
              min = val;
            }
            if (val > max) {
              max = val;
            }
          }
        }

        // fallback
        if (min === Infinity || max === -Infinity) {
          min = 0;
          max = 100;
        }

        bandsArr.push({
          band: i + 1,
          name: `Band ${i + 1}`,
          stats: {
            minimum: min,
            maximum: max,
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
