import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { fromUrl, fromBlob } from 'geotiff';
import { useEffect, useState } from 'react';

import { loadFile } from '@/src/tools';

export interface IMultiBandRow {
  band: number;
  colorInterpretation?: string;
}

const useGetMultiBandInfo = (model: IJupyterGISModel, layer: IJGISLayer) => {
  const [bandRows, setBandRows] = useState<IMultiBandRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBandList = async () => {
    setLoading(true);
    setError(null);

    try {
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

      const rows: IMultiBandRow[] = [];
      for (let i = 0; i < numberOfBands; i++) {
        rows.push({
          band: i,
        });
      }

      setBandRows(rows);
    } catch (err: any) {
      setError(`Error fetching bands: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBandList();
  }, []);

  return { bandRows, setBandRows, loading, error };
};

export default useGetMultiBandInfo;
