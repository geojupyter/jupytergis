export * from './_interface/project/jgis';

// GeoJSON format
export * from './_interface/geojson';

// Sources
export { IGeoPackageVectorSource } from './_interface/project/sources/geoPackageVectorSource';
export { IGeoPackageRasterSource } from './_interface/project/sources/geoPackageRasterSource';
export { IGeoJSONSource } from './_interface/project/sources/geoJsonSource';
export { IGeoTiffSource } from './_interface/project/sources/geoTiffSource';
export { IImageSource } from './_interface/project/sources/imageSource';
export { IRasterDemSource } from './_interface/project/sources/rasterDemSource';
export { IRasterSource } from './_interface/project/sources/rasterSource';
export { IShapefileSource } from './_interface/project/sources/shapefileSource';
export { IVectorTileSource } from './_interface/project/sources/vectorTileSource';
export { IGeoParquetSource } from './_interface/project/sources/geoParquetSource';
export { ICollaborativePointSource } from './_interface/project/sources/collaborativePointSource';
export { IMarkerSource } from './_interface/project/sources/markerSource';
export { IWmsTileSource } from './_interface/project/sources/wmsTileSource';
export { IGeoZarrSource } from './_interface/project/sources/geoZarrSource';
export { IOpenEOTileSource } from './_interface/project/sources/openeoTileSource';

// Layers
export { IHillshadeLayer } from './_interface/project/layers/hillshadeLayer';
export { IStorySegmentLayer } from './_interface/project/layers/storySegmentLayer';
export { IRasterLayer } from './_interface/project/layers/rasterLayer';
export { IVectorLayer } from './_interface/project/layers/vectorLayer';
export { IImageLayer } from './_interface/project/layers/imageLayer';
export { IStacLayer } from './_interface/project/layers/stacLayer';
export { IVectorTileLayer } from './_interface/project/layers/vectorTileLayer';
export { IGeoTiffLayer } from './_interface/project/layers/geoTiffLayer';
export { IGeoZarrLayer } from './_interface/project/layers/geoZarrLayer';
export { IOpenEOTileLayer } from './_interface/project/layers/openeoTileLayer';

// Processing
export * from './processing/_generated/exportProcessingSchema';

// Symbology grammar
export * from './_interface/project/symbology';

import type {
  GeoJSONGeometryCollection,
  GeoJSONLineString,
  GeoJSONMultiLineString,
  GeoJSONMultiPoint,
  GeoJSONMultiPolygon,
  GeoJSONPoint,
  GeoJSONPolygon,
} from './_interface/geojson';
import type { IGrammarLayer } from './_interface/project/symbology';

export interface IGrammarSymbologyState {
  /**
   * Ordered list of independent rendering layers sharing the same source.
   * Each layer produces one renderer layer (Vector, Image, WebGLTile, etc.).
   * Layers are rendered in order (first = bottom).
   */
  layers: IGrammarLayer[];
}

/** Arbitrary attribute bag stamped onto a collaborative feature. */
export interface ICollaborativeFeatureProps {
  [k: string]: string | number | boolean | null;
}

/**
 * GeoJSON geometry types allowed on collaborative overlay features.
 * Coordinates are always EPSG:4326 (lon/lat degrees).
 */
export type ICollaborativeGeometry =
  | GeoJSONPoint
  | GeoJSONLineString
  | GeoJSONPolygon
  | GeoJSONMultiPoint
  | GeoJSONMultiLineString
  | GeoJSONMultiPolygon
  | GeoJSONGeometryCollection;

export interface ICollaborativeFeature {
  id: string;
  /** GeoJSON geometry in EPSG:4326 (any supported type). */
  geometry: ICollaborativeGeometry;
  props: ICollaborativeFeatureProps;
  updatedAt: string;
  updatedBy: string;
  deleted?: boolean;
}

export interface IFeatureStoreMeta {
  softLimit: number;
  hardLimit: number;
  compacting: boolean;
  /** Client fold intent. Server consumes and clears this. */
  foldRequested: boolean;
}

export interface IFeatureStore {
  meta: IFeatureStoreMeta;
  features: {
    [k: string]: ICollaborativeFeature;
  };
}

export interface IJGISFeatureStores {
  [k: string]: IFeatureStore;
}

// exportLayer
export * from './_interface/export/exportGeoJson';
export * from './_interface/export/exportGeoTiff';

// Other
export * from './doc';
export * from './index';
export * from './interfaces';
export * from './model';
export * from './token';

export type Modes =
  | 'panning'
  | 'identifying'
  | 'marking'
  | 'drawing'
  | 'placingPoints';
