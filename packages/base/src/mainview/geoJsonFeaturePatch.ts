import {
  IDict,
  IGeoJSONSource,
  IJGISSource,
  IJupyterGISModel,
} from '@jupytergis/schema';

import { deepCopy } from '@/src/tools';

export interface IPatchGeoJSONFeatureContext {
  model: IJupyterGISModel;
  persistAndRefreshSource: (
    sourceId: string,
    source: IJGISSource,
  ) => Promise<void>;
}

export type PatchGeoJSONFeatureProperties = (
  sourceId: string,
  target: { featureId: string },
  propertyUpdates: IDict<any>,
) => Promise<boolean>;

interface IGeoJSONFeatureLike {
  type: 'Feature';
  id?: string;
  geometry?: {
    type: string;
    coordinates?: unknown;
  } | null;
  properties?: (IDict<any> & { _id?: string }) | null;
}

/**
 * Only concerned with features added via draw tool for now
 */
async function patchGeoJSONFeatureProperties(
  context: IPatchGeoJSONFeatureContext,
  sourceId: string,
  target: { featureId: string },
  propertyUpdates: IDict<any>,
): Promise<boolean> {
  if (!context.model.sharedModel.editable) {
    return false;
  }

  const source = context.model.getSource(sourceId);
  if (!source || source.type !== 'GeoJSONSource') {
    return false;
  }

  const parameters = source.parameters as IGeoJSONSource;
  const data = parameters.data;

  if (!data || data.type !== 'FeatureCollection') {
    return false;
  }

  const features = data.features as IGeoJSONFeatureLike[];

  const featureId = target.featureId;
  const index = features.findIndex(
    feature => feature.properties?._id === featureId,
  );

  if (index < 0 || index >= features.length) {
    return false;
  }

  const updatedSource = deepCopy(source);
  const updatedParameters = updatedSource.parameters as IDict<any>;
  const updatedData = updatedParameters.data as {
    type: 'FeatureCollection';
    features: IGeoJSONFeatureLike[];
  };
  const updatedFeature = updatedData.features[index];
  const nextProperties: IDict<any> = { ...(updatedFeature.properties ?? {}) };

  Object.entries(propertyUpdates).forEach(([key, value]) => {
    if (value === undefined) {
      delete nextProperties[key];
      return;
    }

    nextProperties[key] = value;
  });

  updatedFeature.properties = nextProperties;

  await context.persistAndRefreshSource(sourceId, updatedSource);

  return true;
}

export function createGeoJSONFeaturePatcher(
  context: IPatchGeoJSONFeatureContext,
): PatchGeoJSONFeatureProperties {
  return (
    sourceId: string,
    target: { featureId: string },
    propertyUpdates: IDict<any>,
  ) =>
    patchGeoJSONFeatureProperties(context, sourceId, target, propertyUpdates);
}
