import { IJGISSource, IJGISSourceMetadata } from '@jupytergis/schema';

import { ILayerMetadata } from './types';
import { getSourceLocation } from './utils/source';

/**
 * Version of the code that produces stored metadata.
 *
 * Bump this whenever a provider starts reading something it previously could
 * not, or fixes what it reported. Documents written by an older version are
 * treated as stale and re-read, so an improvement reaches existing projects
 * instead of only new ones.
 */
export const METADATA_VERSION = 1;

/**
 * Whether a source is worth storing metadata for.
 *
 * Sources that carry their data inline (a GeoJSON `data` parameter, a `data:`
 * URI) are excluded: reading them costs nothing because the bytes are already
 * in the document, and storing a derived copy alongside them would roughly
 * double the file for no gain.
 */
export function shouldPersistMetadata(source: IJGISSource): boolean {
  const location = getSourceLocation(source);
  return Boolean(location) && !location?.startsWith('data:');
}

/**
 * Whether stored metadata still describes what the source currently points at.
 *
 * The fingerprint deliberately tracks the source *location* and the version of
 * the code that read it, not the bytes: checking the bytes would mean a network
 * round trip on every open, which is the cost this whole mechanism exists to
 * avoid. The trade is that a URL whose contents change without its address
 * changing keeps its old metadata until something else invalidates it.
 */
export function isMetadataFresh(
  stored: IJGISSourceMetadata | undefined,
  source: IJGISSource,
): boolean {
  const fingerprint = stored?.fingerprint;

  if (!fingerprint) {
    return false;
  }

  return (
    fingerprint.version === METADATA_VERSION &&
    fingerprint.source === getSourceLocation(source)
  );
}

/**
 * Narrow what a provider produced down to what is worth storing.
 *
 * `general` is dropped: it is the layer and source names and types, which are
 * read straight from the document, change when the user renames things, and
 * would go stale the moment they did. Everything else — including the notes
 * that qualify a value, such as a band range having been estimated — is kept,
 * so a stored estimate is never presented later as if it had been read.
 */
export function toStoredMetadata(
  metadata: Partial<ILayerMetadata>,
  source: IJGISSource,
): IJGISSourceMetadata {
  return {
    crs: metadata.crs,
    extent: metadata.extent,
    bands: metadata.bands,
    pyramid: metadata.pyramid,
    vector: metadata.vector,
    extra: metadata.extra,
    notes: metadata.notes,
    fingerprint: {
      source: getSourceLocation(source) ?? '',
      version: METADATA_VERSION,
      readAt: new Date().toISOString(),
    },
  };
}

/**
 * Turn stored metadata back into the shape the Information tab renders.
 */
export function fromStoredMetadata(
  stored: IJGISSourceMetadata,
): Partial<ILayerMetadata> {
  return {
    crs: stored.crs,
    extent: stored.extent,
    bands: stored.bands,
    pyramid: stored.pyramid,
    vector: stored.vector,
    extra: stored.extra,
    notes: stored.notes,
  };
}

/**
 * True when there is nothing worth writing.
 *
 * A provider that could not read anything should not leave a fingerprint
 * behind, or the empty result would be cached and never retried.
 */
export function isEmptyMetadata(metadata: Partial<ILayerMetadata>): boolean {
  return !(
    metadata.crs ||
    metadata.extent ||
    metadata.bands?.length ||
    metadata.pyramid ||
    metadata.vector ||
    metadata.extra?.length
  );
}
