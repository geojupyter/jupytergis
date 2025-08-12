import { GeoJSONFeature1, IJupyterGISModel } from '@jupytergis/schema';
import { useEffect, useState } from 'react';

import { loadFile } from '@/src/tools';

interface IUseGetFeaturesProps {
  layerId?: string;
  model: IJupyterGISModel;
}

interface IUseGetFeaturesResult {
  features: GeoJSONFeature1[];
  isLoading: boolean;
  error?: Error;
}

export const useGetFeatures = ({
  layerId,
  model,
}: IUseGetFeaturesProps): IUseGetFeaturesResult => {
  const [features, setFeatures] = useState<GeoJSONFeature1[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | undefined>();

  const fetchFeatures = async () => {
    if (!layerId) {
      return;
    }

    try {
      const layer = model.getLayer(layerId);
      const source = model.getSource(layer?.parameters?.source);

      if (!source) {
        throw new Error('Source not found');
      }

      const data = await loadFile({
        filepath: source.parameters?.path,
        type: 'GeoJSONSource',
        model: model,
      });

      if (!data) {
        throw new Error('Failed to read GeoJSON data');
      }

      setFeatures(data.features || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatures();
  }, [model, layerId]);

  return { features, isLoading, error };
};
