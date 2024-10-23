// import { GeoJSONFeature } from 'geojson';

import { GeoJSONFeature1, IJupyterGISModel } from '@jupytergis/schema';
import { useEffect, useState } from 'react';

interface IUseGetPropertiesProps {
  layerId?: string;
  model: IJupyterGISModel;
}

interface IUseGetPropertiesResult {
  featureProps: Record<string, Set<any>>;
  isLoading: boolean;
  error?: Error;
}

export const useGetProperties = ({
  layerId,
  model
}: IUseGetPropertiesProps): IUseGetPropertiesResult => {
  const [featureProps, setFeatureProps] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  const getProperties = async () => {
    if (!layerId) {
      return;
    }

    try {
      const layer = model.getLayer(layerId);
      const source = model.getSource(layer?.parameters?.source);

      if (!source) {
        throw new Error('Source not found');
      }

      const data = await model.readGeoJSON(source.parameters?.path);

      if (!data) {
        throw new Error('Failed to read GeoJSON data');
      }

      const result: Record<string, Set<any>> = {};

      data.features.forEach((feature: GeoJSONFeature1) => {
        if (feature.properties) {
          Object.entries(feature.properties).forEach(([key, value]) => {
            if (!(key in result)) {
              result[key] = new Set();
            }
            result[key].add(value);
          });
        }
      });

      setFeatureProps(result);
      setIsLoading(false);
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getProperties();
  }, [model, layerId]);

  return { featureProps, isLoading, error };
};
