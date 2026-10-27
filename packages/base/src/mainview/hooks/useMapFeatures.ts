import type { IJupyterGISModel } from '@jupytergis/schema';
import { useEffect, useState } from 'react';

import type { IMapAdapterFeatures } from './../mapAdapterFeatures';
import { getMapFeatures, mapFeaturesChanged } from './../mapFeaturesRegistry';

export function useMapFeatures(
  model: IJupyterGISModel,
): IMapAdapterFeatures | undefined {
  const [features, setFeatures] = useState(() => getMapFeatures(model));

  useEffect(() => {
    const refresh = (_: object, changed: IJupyterGISModel) => {
      if (changed === model) {
        setFeatures(getMapFeatures(model));
      }
    };
    mapFeaturesChanged.connect(refresh);
    setFeatures(getMapFeatures(model));
    return () => {
      mapFeaturesChanged.disconnect(refresh);
    };
  }, [model]);

  return features;
}
