import { IJGISLayer, IJGISSource, IJupyterGISModel } from '@jupytergis/schema';

/**
 * A single label/value row rendered in the Metadata tab.
 */
export interface IMetadataField {
  label: string;
  value: string;
  /**
   * Render the value in a monospace font. Use for proj strings, WKT, URLs and
   * anything else where character alignment carries meaning.
   */
  mono?: boolean;
  /**
   * Render the value as an external link pointing at this URL.
   */
  href?: string;
}

/**
 * The coordinate reference system the data is stored in.
 *
 * Every field is optional: most formats only tell us some of this, and it is
 * better to show the user what we actually know than to display empty rows.
 */
export interface ICrsMetadata {
  /** Normalized authority code, e.g. `EPSG:26915`. */
  code?: string;
  /** Human readable name, e.g. `NAD83 / UTM zone 15N`. */
  name?: string;
  /** proj4 definition string. */
  proj4?: string;
  /**
   * Well-known text. Only populated when the file itself carries it; we do not
   * ship an EPSG database, so this is often unavailable.
   */
  wkt?: string;
  /** Linear/angular unit of the CRS, e.g. `m` or `degrees`. */
  units?: string;
}

/**
 * The geographic extent (bounding box) of the data, as
 * `[minX, minY, maxX, maxY]`.
 */
export interface IExtentMetadata {
  /** Extent in the data's own CRS. */
  native?: number[];
  /** The CRS `native` is expressed in. */
  nativeCrs?: string;
  /** Extent in `EPSG:4326`, for readers who think in latitude/longitude. */
  wgs84?: number[];
  /**
   * True when this is the extent the layer occupies on the map rather than one
   * read from the file itself. Displayed with a caveat so that the user is not
   * told the file's native extent is something it is not.
   */
  approximate?: boolean;
}

/**
 * A single band (raster) of the data.
 */
export interface IBandMetadata {
  /** 1-based band index. */
  band: number;
  name: string;
  dataType?: string;
  colorInterpretation?: string;
  noData?: string;
  minimum?: number;
  maximum?: number;
}

/**
 * One level of an internal tile pyramid (a GeoTIFF overview, a Zarr multiscale
 * level, ...).
 */
export interface IPyramidLevel {
  /** 0 is the full resolution image. */
  level: number;
  width?: number;
  height?: number;
  /** Downsampling factor relative to the full resolution image. */
  scale?: number;
  /** Free-form label, used by formats that name their levels (e.g. Zarr). */
  name?: string;
}

/**
 * Information about how the data is tiled and pyramided.
 */
export interface IPyramidMetadata {
  levels: IPyramidLevel[];
  tileWidth?: number;
  tileHeight?: number;
  /** Whether the data is internally tiled (as opposed to stripped). */
  tiled?: boolean;
  /** Tiled web services expose a zoom range rather than overview levels. */
  minZoom?: number;
  maxZoom?: number;
}

/**
 * Information specific to vector data.
 */
export interface IVectorMetadata {
  featureCount?: number;
  geometryTypes?: string[];
  fields?: { name: string; type: string }[];
}

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
