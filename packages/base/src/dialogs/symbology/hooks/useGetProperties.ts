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

async function getGeoJsonProperties({
  source,
  model,
}: {
  source: any;
  model: IJupyterGISModel;
}): Promise<Record<string, Set<any>>> {
  const result: Record<string, Set<any>> = {};

  const data = await (async () => {
    if (source.parameters?.path) {
      return await loadFile({
        filepath: source.parameters?.path,
        type: 'GeoJSONSource',
        model,
      });
    } else if (source.parameters?.data) {
      return source.parameters.data;
    }
  })();

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

  return result;
}

function getVectorTileProperties({
  model,
  sourceId,
}: {
  model: IJupyterGISModel;
  sourceId: string;
}): Record<string, Set<any>> {
  const result: Record<string, Set<any>> = {};
  const features = model.getFeaturesForCurrentTile({ sourceId });

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

  return result;
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
      let result: Record<string, Set<any>> = {};

      if (sourceType === 'GeoJSONSource') {
        result = await getGeoJsonProperties({ source, model });
      } else if (sourceType === 'VectorTileSource') {
        const sourceId = layer?.parameters?.source;
        result = getVectorTileProperties({ model, sourceId });
      } else {
        throw new Error(`Unsupported source type: ${sourceType}`);
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
