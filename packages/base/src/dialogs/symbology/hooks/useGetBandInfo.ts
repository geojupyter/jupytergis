import { IDict, IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { useEffect, useState } from 'react';
import { loadFile } from '../../../tools';

export interface IBandHistogram {
  buckets: number[];
  count: number;
  max: number;
  min: number;
}

export interface IBandRow {
  band: number;
  colorInterpretation: string;
  stats: {
    minimum: number;
    maximum: number;
    mean: number;
    stdDev: number;
  };
  metadata: IDict;
  histogram: IBandHistogram;
}

interface ITifBandData {
  band: number;
  colorInterpretation: string;
  minimum: number;
  maximum: number;
  mean: number;
  stdDev: number;
  metadata: object;
  histogram: any;
}

const preloadGeoTiffFile = async (
  sourceInfo: {
    url?: string | undefined;
  },
  model: IJupyterGISModel
): Promise<{ file: Blob; metadata: any; sourceUrl: string }> => {
  return await loadFile({
    filepath: sourceInfo.url ?? '',
    type: 'GeoTiffSource',
    model: model
  });
};

const useGetBandInfo = (
  context: DocumentRegistry.IContext<IJupyterGISModel>,
  layer: IJGISLayer
) => {
  const [bandRows, setBandRows] = useState<IBandRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBandInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const bandsArr: IBandRow[] = [];
      const source = context.model.getSource(layer?.parameters?.source);
      const sourceInfo = source?.parameters?.urls[0];

      if (!sourceInfo?.url) {
        setError('No source URL found.');
        setLoading(false);
        return;
      }

      const preloadedFile = await preloadGeoTiffFile(sourceInfo, context.model);
      const { file, metadata, sourceUrl } = { ...preloadedFile };

      if (file && metadata && sourceUrl === sourceInfo.url) {
        metadata['bands'].forEach((bandData: ITifBandData) => {
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
      } else {
        setError('Failed to preload the file or metadata mismatch.');
      }
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
