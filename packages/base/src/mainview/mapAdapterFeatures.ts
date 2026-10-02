import type {
  IJGISLayer,
  IJGISSource,
  LayerType,
  SourceType,
} from '@jupytergis/schema';

import { MapAdapterType } from './mapAdapter';

export interface IMapAdapterFeatures {
  readonly name: string;
  readonly sources: Readonly<Record<SourceType, boolean>>;
  readonly layers: Readonly<Record<LayerType, boolean>>;
  readonly addMarker: boolean;
  readonly identify: boolean;
  readonly drawTool: boolean;
  readonly geolocation: boolean;
  readonly layerComparison: boolean;
}

const MAPLIBRE_FEATURES: IMapAdapterFeatures = {
  name: 'MapLibre',
  sources: {
    RasterSource: true,
    RasterDemSource: true,
    VectorTileSource: true,
    GeoJSONSource: true,
    ImageSource: false,
    ShapefileSource: false,
    GeoTiffSource: false,
    GeoZarrSource: false,
    GeoPackageVectorSource: false,
    GeoPackageRasterSource: false,
    GeoParquetSource: false,
    MarkerSource: false,
    WmsTileSource: false,
    OpenEOTileSource: false,
  },
  layers: {
    RasterLayer: true,
    VectorLayer: true,
    VectorTileLayer: true,
    HillshadeLayer: true,
    TerrainLayer: true,
    StorySegmentLayer: true,
    ImageLayer: false,
    GeoTiffLayer: false,
    GeoZarrLayer: false,
    OpenEOTileLayer: false,
    StacLayer: false,
  },
  addMarker: false,
  identify: false,
  drawTool: false,
  geolocation: false,
  layerComparison: false,
};

const OPENLAYERS_FEATURES: IMapAdapterFeatures = {
  name: 'OpenLayers',
  sources: {
    RasterSource: true,
    RasterDemSource: true,
    VectorTileSource: true,
    GeoJSONSource: true,
    ImageSource: true,
    ShapefileSource: true,
    GeoTiffSource: true,
    GeoZarrSource: true,
    GeoPackageVectorSource: true,
    GeoPackageRasterSource: true,
    GeoParquetSource: true,
    MarkerSource: true,
    WmsTileSource: true,
    OpenEOTileSource: true,
  },
  layers: {
    RasterLayer: true,
    VectorLayer: true,
    VectorTileLayer: true,
    HillshadeLayer: true,
    TerrainLayer: false,
    StorySegmentLayer: true,
    ImageLayer: true,
    GeoTiffLayer: true,
    GeoZarrLayer: true,
    OpenEOTileLayer: true,
    StacLayer: true,
  },
  addMarker: true,
  identify: true,
  drawTool: true,
  geolocation: true,
  layerComparison: true,
};

export const MAP_ADAPTER_FEATURES: Readonly<
  Record<MapAdapterType, IMapAdapterFeatures>
> = {
  maplibre: MAPLIBRE_FEATURES,
  openlayers: OPENLAYERS_FEATURES,
};

/**
 * Get the unsupported reason for a layer or source.
 */
export function getUnsupportedReason(
  features: IMapAdapterFeatures,
  layer: IJGISLayer,
  source?: IJGISSource,
): string | undefined {
  if (!features.layers[layer.type]) {
    return `${features.name} does not support ${layer.type} layers.`;
  }

  if (source && !features.sources[source.type]) {
    return `${features.name} does not support ${source.type} sources.`;
  }

  return undefined;
}
