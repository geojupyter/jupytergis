import { IJupyterGISModel, SourceType } from '@jupytergis/schema';

import { documentProvider } from './providers/documentProvider';
import { geoTiffProvider } from './providers/geoTiffProvider';
import { geoZarrProvider } from './providers/geoZarrProvider';
import { tileProvider } from './providers/tileProvider';
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

  RasterSource: tileProvider,
  VectorTileSource: tileProvider,
  WmsTileSource: tileProvider,

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

  const provider = metadataProviders[context.source.type];

  if (!provider) {
    return withNote(
      base,
      `JupyterGIS cannot yet read detailed information from ${context.source.type}.`,
    );
  }

  return mergeMetadata(base, await provider(context));
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
