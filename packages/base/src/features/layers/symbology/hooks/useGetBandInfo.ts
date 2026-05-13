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

const useGetBandInfo = (model: IJupyterGISModel, layer: IJGISLayer) => {
  const [bandRows, setBandRows] = useState<IBandRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBandInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const source = model.getSource(layer?.parameters?.source);

      if (layer?.type === 'GeoZarrLayer') {
        const bands: string[] = source?.parameters?.bands?.length
          ? source.parameters.bands
          : ['BO4', 'BO3', 'BO2'];

        const bandsArr: IBandRow[] = bands.map((name: string, i: number) => ({
          band: i + 1,
          colorInterpretation: name,
          stats: {
            minimum: 0,
            maximum: 1,
          },
        }));

        setBandRows(bandsArr);
        setLoading(false);
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

      const image = await tiff.getImage();
      const numberOfBands = image.getSamplesPerPixel();

      const bandsArr: IBandRow[] = [];
      for (let i = 0; i < numberOfBands; i++) {
        bandsArr.push({
          band: i + 1,
          stats: {
            minimum: sourceInfo.min ?? 0,
            maximum: sourceInfo.max ?? 100,
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
