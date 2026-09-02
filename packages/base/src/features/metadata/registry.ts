import { IJupyterGISModel, SourceType } from '@jupytergis/schema';

import {
  fromStoredMetadata,
  isEmptyMetadata,
  isMetadataFresh,
  shouldPersistMetadata,
  toStoredMetadata,
} from './persistence';
import { documentProvider } from './providers/documentProvider';
import { geoTiffProvider } from './providers/geoTiffProvider';
import { geoZarrProvider } from './providers/geoZarrProvider';
import { tileMetadata } from './providers/tileProvider';
import { vectorProvider } from './providers/vectorProvider';
import {
  ILayerMetadata,
  IMetadataContext,
  ISourceMetadataContext,
  MetadataProvider,
} from './types';

/**
 * Format-specific metadata readers, keyed by source type.
 *
 * A source type that is missing here is not an error: it falls back to the
 * document provider and still shows its name, type, location and the extent the
 * map computed for it. Add an entry here to read a format properly.
 */
const metadataProviders: Partial<Record<SourceType, MetadataProvider>> = {
  GeoTiffSource: geoTiffProvider,
  GeoZarrSource: geoZarrProvider,

  GeoJSONSource: vectorProvider,
  ShapefileSource: vectorProvider,
  GeoParquetSource: vectorProvider,

  // ADD MORE METADATA PROVIDERS HERE
};

/**
 * Collect everything we know about the given layer or source.
 *
 * The document provider always runs first so that there is a baseline to show,
 * then the format-specific provider (if any) overrides the parts it can read
 * properly from the data itself.
 */
export async function getLayerMetadata(
  model: IJupyterGISModel,
  selectedId: string,
): Promise<ILayerMetadata> {
  const context = buildContext(model, selectedId);

  if (!context) {
    throw new Error('Select a layer or source to see its information.');
  }

  const base = await documentProvider(context);

  if (!isSourceContext(context)) {
    return withNote(
      base,
      'This layer stores its data in the document rather than in a separate source, so there is no file to inspect.',
    );
  }

  // Tiled services describe themselves entirely from their own parameters, so
  // they are answered from the document and never read, stored or invalidated.
  const tile = tileMetadata(context.source);
  if (tile) {
    return mergeMetadata(base, tile);
  }

  // Metadata is normally written into the document when the source is added,
  // so this is the usual path: no network, no decoding, just a field read.
  const stored = context.source.metadata;
  if (stored && isMetadataFresh(stored, context.source)) {
    return mergeMetadata(base, fromStoredMetadata(stored));
  }

  const details = await readSourceMetadata(context);

  if (!details) {
    return withNote(
      base,
      `JupyterGIS cannot yet read detailed information from ${context.source.type}.`,
    );
  }

  // Documents written before this feature existed, and sources added through
  // the Python API with no browser attached, arrive here with nothing stored.
  // Writing it back means they are only read once rather than on every visit.
  void storeSourceMetadata(context, details);

  return mergeMetadata(base, details);
}

/**
 * Read a source's metadata and store it in the document, so that later readers
 * — the Information tab, the Python API, the QGIS exporter — get it from the
 * document instead of reading the file again.
 *
 * Returns false when the source has no provider, has nothing worth storing, or
 * already holds current metadata.
 */
export async function populateSourceMetadata(
  model: IJupyterGISModel,
  sourceId: string,
): Promise<boolean> {
  const context = buildContext(model, sourceId);

  if (!context || !isSourceContext(context) || tileMetadata(context.source)) {
    return false;
  }

  if (
    !shouldPersistMetadata(context.source) ||
    isMetadataFresh(context.source.metadata, context.source)
  ) {
    return false;
  }

  const details = await readSourceMetadata(context);

  return details ? storeSourceMetadata(context, details) : false;
}

/**
 * Run the format-specific provider, or return undefined when there is not one.
 */
async function readSourceMetadata(
  context: ISourceMetadataContext,
): Promise<Partial<ILayerMetadata> | undefined> {
  const provider = metadataProviders[context.source.type];

  return provider ? await provider(context) : undefined;
}

/**
 * Write metadata onto the source.
 *
 * Nothing is written for sources whose data is inline, or when the provider
 * came back empty — caching an empty result would mean never trying again.
 * The source is re-read immediately before the write so that a rename or a
 * parameter edit made while the file was being read is not clobbered.
 */
async function storeSourceMetadata(
  context: ISourceMetadataContext,
  details: Partial<ILayerMetadata>,
): Promise<boolean> {
  const { model, sourceId } = context;

  if (!shouldPersistMetadata(context.source) || isEmptyMetadata(details)) {
    return false;
  }

  const current = model.getSource(sourceId);

  if (!current) {
    return false;
  }

  try {
    model.sharedModel.updateSource(sourceId, {
      ...current,
      metadata: toStoredMetadata(details, current),
    });
    return true;
  } catch (error) {
    // A read-only document, or one whose provider rejected the write. The
    // Information tab still has the metadata it just read; it will simply be
    // read again next time.
    console.debug(`Could not store metadata for source ${sourceId}:`, error);
    return false;
  }
}

/**
 * Resolve the selected id, which may be either a layer or a source, into the
 * layer/source pair a provider needs.
 */
function buildContext(
  model: IJupyterGISModel,
  selectedId: string,
): IMetadataContext | undefined {
  const layer = model.getLayer(selectedId);

  if (layer) {
    // `StacLayer` and `StorySegmentLayer` hold their data inline, so a layer
    // without a source is expected rather than an error.
    const sourceId = layer.parameters?.source;
    const source = sourceId ? model.getSource(sourceId) : undefined;

    return {
      model,
      layerId: selectedId,
      layer,
      sourceId: source ? sourceId : undefined,
      source,
    };
  }

  const source = model.getSource(selectedId);

  return source ? { model, sourceId: selectedId, source } : undefined;
}

function isSourceContext(
  context: IMetadataContext,
): context is ISourceMetadataContext {
  return Boolean(context.source && context.sourceId);
}

function withNote(metadata: ILayerMetadata, note: string): ILayerMetadata {
  return { ...metadata, notes: [...(metadata.notes ?? []), note] };
}

/**
 * Layer the format-specific metadata over the document baseline.
 *
 * Sections are replaced wholesale rather than deep-merged: a provider that read
 * the real extent out of a file should not end up with half of the fallback
 * extent mixed into it. Notes accumulate, since each layer may have something
 * worth saying.
 */
function mergeMetadata(
  base: ILayerMetadata,
  details: Partial<ILayerMetadata>,
): ILayerMetadata {
  const notes = [...(base.notes ?? []), ...(details.notes ?? [])];

  return {
    general: [...base.general, ...(details.general ?? [])],
    crs: details.crs ?? base.crs,
    extent: details.extent ?? base.extent,
    bands: details.bands ?? base.bands,
    pyramid: details.pyramid ?? base.pyramid,
    vector: details.vector ?? base.vector,
    extra: [...(base.extra ?? []), ...(details.extra ?? [])],
    notes: notes.length ? notes : undefined,
  };
}
