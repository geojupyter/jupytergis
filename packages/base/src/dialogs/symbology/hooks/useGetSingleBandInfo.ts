import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { fromUrl, fromBlob } from 'geotiff';
import { useEffect, useState } from 'react';

import { loadFile } from '@/src/tools';

export interface ISingleBandRow {
  band: number;
  colorInterpretation?: string;
  stats: {
    minimum: number;
    maximum: number;
  };
}

const useGetSingleBandInfo = (model: IJupyterGISModel, layer: IJGISLayer) => {
  const [bandRows, setBandRows] = useState<ISingleBandRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBandInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const source = model.getSource(layer?.parameters?.source);
      const sourceInfo = source?.parameters?.urls[0];

      if (!sourceInfo?.url) {
        setError('No source URL found.');
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

      const bands: ISingleBandRow[] = [];
      for (let i = 0; i < numberOfBands; i++) {
        bands.push({
          band: i + 1,
          stats: {
            minimum: sourceInfo.min ?? 0,
            maximum: sourceInfo.max ?? 100,
          },
        });
      }

      setBandRows(bands);
    } catch (err: any) {
      setError(`Error fetching bands: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBandInfo();
  }, []);

  return { bandRows, setBandRows, loading, error };
};

export default useGetSingleBandInfo;
