// import { GeoJSONFeature } from 'geojson';

import { GeoJSONFeature1, IJupyterGISModel } from '@jupytergis/schema';
import { useEffect, useState } from 'react';

import { loadFile } from '@/src/tools';

interface IUseGetPropertiesProps {
  layerId?: string;
  model: IJupyterGISModel;
}

interface IUseGetPropertiesResult {
  featureProperties: Record<string, Set<any>>;
  isLoading: boolean;
  error?: Error;
}

export const useGetProperties = ({
  layerId,
  model,
}: IUseGetPropertiesProps): IUseGetPropertiesResult => {
  const [featureProperties, setFeatureProperties] = useState<
    Record<string, Set<any>>
  >({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | undefined>();

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

      const sourceType = source?.type;

      const result: Record<string, Set<any>> = {};

      if (sourceType === 'GeoJSONSource') {
        const data = await loadFile({
          filepath: source.parameters?.path,
          type: 'GeoJSONSource',
          model: model,
        });

        if (!data) {
          throw new Error('Failed to read GeoJSON data');
        }

        data.features.forEach((feature: GeoJSONFeature1) => {
          if (feature.properties) {
            for (const [key, value] of Object.entries(feature.properties)) {
              if (!result[key]) {
                result[key] = new Set();
              }
              result[key].add(value);
            }
          }
        });
      } else if (sourceType === 'VectorTileSource') {
        if (!layer?.parameters) {
          return;
        }
        if (typeof model.getFeaturesForLayer !== 'function') {
          throw new Error('model.getFeaturesForLayer not available');
        }

        const features = model.getFeaturesForLayer(
          layer.parameters.source,
        );

        if (feature.length === 0) {
          throw new Error('No features found in extent');
        }

        features.forEach(feature => {
          const props = feature.getProperties?.();
          if (props) {
            for (const [key, value] of Object.entries(props)) {
              if (!result[key]) {
                result[key] = new Set();
              }
              result[key].add(value);
            }
          }
        });
      }

      setFeatureProperties(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getProperties();
  }, [model, layerId]);

  return { featureProperties, isLoading, error };
};
