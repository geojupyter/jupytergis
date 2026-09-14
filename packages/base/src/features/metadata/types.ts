import {
  IJGISBandMetadata,
  IJGISCrsMetadata,
  IJGISExtentMetadata,
  IJGISLayer,
  IJGISMetadataField,
  IJGISPyramidLevel,
  IJGISPyramidMetadata,
  IJGISSource,
  IJGISVectorMetadata,
  IJupyterGISModel,
} from '@jupytergis/schema';

/**
 * The data-carrying halves of the metadata are defined in the schema rather
 * than here, because they are persisted into the `.jGIS` document (see
 * `persistence.ts`) and read back by the Python API and the QGIS exporter.
 * Aliasing them keeps a single definition: a change to the stored shape is a
 * schema change, and cannot drift away from what the UI renders.
 */
export type IMetadataField = IJGISMetadataField;
export type ICrsMetadata = IJGISCrsMetadata;
export type IExtentMetadata = IJGISExtentMetadata;
export type IBandMetadata = IJGISBandMetadata;
export type IPyramidLevel = IJGISPyramidLevel;
export type IPyramidMetadata = IJGISPyramidMetadata;
export type IVectorMetadata = IJGISVectorMetadata;

/**
 * Everything the Metadata tab knows about one layer or source.
 */
export interface ILayerMetadata {
  general: IMetadataField[];
  crs?: ICrsMetadata;
  extent?: IExtentMetadata;
  bands?: IBandMetadata[];
  pyramid?: IPyramidMetadata;
  vector?: IVectorMetadata;
  /** Extra provider-specific rows that do not fit the sections above. */
  extra?: IMetadataField[];
  /**
   * Non-fatal problems, e.g. "band statistics are not stored in this file".
   * Shown to the user so that a missing section is explained rather than
   * silently empty.
   */
  notes?: string[];
}

/**
 * What we are describing.
 *
 * The source is optional: a few layer types (`StacLayer`, `StorySegmentLayer`)
 * carry their data in the document instead of pointing at a source.
 */
export interface IMetadataContext {
  model: IJupyterGISModel;
  /** Undefined when the user selected a source directly. */
  layerId?: string;
  layer?: IJGISLayer;
  sourceId?: string;
  source?: IJGISSource;
}

/**
 * What a provider is handed to do its work. Providers are only ever looked up
 * by source type, so by the time one runs there is definitely a source.
 */
export interface ISourceMetadataContext extends IMetadataContext {
  sourceId: string;
  source: IJGISSource;
}

/**
 * Produces the format-specific half of the metadata. Whatever a provider omits
 * is filled in by the document provider, so a provider only needs to describe
 * what it can genuinely read from its format.
 */
export type MetadataProvider = (
  context: ISourceMetadataContext,
) => Promise<Partial<ILayerMetadata>>;
