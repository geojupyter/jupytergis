import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { useEffect, useState } from 'react';
import { fromUrl } from 'geotiff';

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

      // TODO Get band names + get band stats
      const tiff = await fromUrl(sourceInfo.url);
      const image = await tiff.getImage();
      const numberOfBands = image.getSamplesPerPixel();

      for (let i = 0; i < numberOfBands; i++) {
        bandsArr.push({
          band: i,
          stats: {
            minimum: sourceInfo.min ?? 0,
            maximum: sourceInfo.max ?? 100
          }
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
