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

      const symbology = layer?.parameters?.symbologyState;

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

      const bandsArr: IBandRow[] = [];
      for (let i = 0; i < numberOfBands; i++) {
        bandsArr.push({
          band: i + 1,
          name: `Band ${i + 1}`,
          stats: {
            minimum: symbology.min ?? 0,
            maximum: symbology.max ?? 100,
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
