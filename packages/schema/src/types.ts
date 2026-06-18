export * from './_interface/project/jgis';

// Sources
export * from './_interface/project/sources/geoPackageVectorSource';
export * from './_interface/project/sources/geoPackageRasterSource';
export * from './_interface/project/sources/geoJsonSource';
export * from './_interface/project/sources/geoTiffSource';
export * from './_interface/project/sources/imageSource';
export * from './_interface/project/sources/rasterDemSource';
export * from './_interface/project/sources/rasterSource';
export * from './_interface/project/sources/shapefileSource';
export * from './_interface/project/sources/vectorTileSource';
export * from './_interface/project/sources/videoSource';
export * from './_interface/project/sources/geoParquetSource';
export * from './_interface/project/sources/markerSource';
export * from './_interface/project/sources/wmsTileSource';
export * from './_interface/project/sources/geoZarrSource';
export * from './_interface/project/sources/openeoTileSource';

// Layers
export * from './_interface/project/layers/hillshadeLayer';
export * from './_interface/project/layers/storySegmentLayer';
export * from './_interface/project/layers/rasterLayer';
export * from './_interface/project/layers/vectorLayer';
export * from './_interface/project/layers/imageLayer';
export * from './_interface/project/layers/stacLayer';
export * from './_interface/project/layers/vectorTileLayer';
export * from './_interface/project/layers/geoTiffLayer';
export * from './_interface/project/layers/geoZarrLayer';
export * from './_interface/project/layers/openeoTileLayer';

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
