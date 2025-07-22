/*
 * A "barrel" file (https://basarat.gitbook.io/typescript/main-1/barrel) making all
 * types generated from JSONSchemas in the `schemas` directory available for
 * import.
 */
export * from './_interface/project/jgis';

// Sources
export * from './_interface/project/sources/geoJsonSource';
export * from './_interface/project/sources/geoTiffSource';
export * from './_interface/project/sources/imageSource';
export * from './_interface/project/sources/rasterDemSource';
export * from './_interface/project/sources/rasterSource';
export * from './_interface/project/sources/shapefileSource';
export * from './_interface/project/sources/vectorTileSource';
export * from './_interface/project/sources/videoSource';
export * from './_interface/project/sources/geoParquetSource';

// Layers
export * from './_interface/project/layers/heatmapLayer';
export * from './_interface/project/layers/hillshadeLayer';
export * from './_interface/project/layers/rasterLayer';
export * from './_interface/project/layers/vectorLayer';
export * from './_interface/project/layers/imageLayer';
export * from './_interface/project/layers/stacLayer';
export * from './_interface/project/layers/vectorTileLayer';
export * from './_interface/project/layers/webGlLayer';

// Symbology
// Use namespaced exports to avoid duplicate interface exports when $ref schemas
// are inlined by json-schema-to-typescript. This can be removed once
// https://github.com/bcherny/json-schema-to-typescript/pull/662 is merged.
export * as SymbologyVectorColor from './_interface/project/layers/symbology/vectorColor';
export * as SymbologyVectorSize from './_interface/project/layers/symbology/vectorSize';
export * as SymbologyGeoTiffSingleBand from './_interface/project/layers/symbology/geoTiffSingleBand';
export * as SymbologyGeoTiffMultiBand from './_interface/project/layers/symbology/geoTiffMultiBand';


// Processing
export * from './processing/_generated/exportProcessingSchema';

// exportLayer
export * from './_interface/export/exportGeoJson';
export * from './_interface/export/exportGeoTiff';


// Other
export * from './doc';
export * from './index';
export * from './interfaces';
export * from './model';
export * from './token';
