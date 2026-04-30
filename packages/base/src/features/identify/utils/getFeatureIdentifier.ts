import { IIdentifiedFeature } from '@jupytergis/schema';

/**
 * Resolve a stable feature identifier across common property names.
 */
export function getFeatureIdentifier(
  feature: IIdentifiedFeature,
): string | undefined {
  const rawIdentifier =
    feature._id ?? feature.id ?? feature.fid ?? feature.featureId;

  if (typeof rawIdentifier === 'string') {
    return rawIdentifier;
  }

  if (typeof rawIdentifier === 'number') {
    return String(rawIdentifier);
  }

  return undefined;
}
