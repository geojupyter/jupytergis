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
export { IVideoSource } from './_interface/project/sources/videoSource';
export { IGeoParquetSource } from './_interface/project/sources/geoParquetSource';
export { IMarkerSource } from './_interface/project/sources/markerSource';
export { IWmsTileSource } from './_interface/project/sources/wmsTileSource';
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
export { IOpenEOTileLayer } from './_interface/project/layers/openeoTileLayer';

// Processing
export * from './processing/_generated/exportProcessingSchema';

// Symbology grammar
export * from './_interface/project/symbology';

import type { IGrammarLayer } from './_interface/project/symbology';

export interface IGrammarSymbologyState {
  /**
   * Ordered list of independent rendering layers sharing the same source.
   * Each layer produces one renderer layer (Vector, Image, WebGLTile, etc.).
   * Layers are rendered in order (first = bottom).
   */
  layers: IGrammarLayer[];
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

export type Modes = 'panning' | 'identifying' | 'marking';
