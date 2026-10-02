import type {
  IJGISLayer,
  IJGISSource,
  LayerType,
  SourceType,
} from '@jupytergis/schema';

import { MapAdapterType } from './mapAdapter';

export interface IMapAdapterFeature {
  readonly name: string;
  readonly sources: Readonly<Record<SourceType, boolean>>;
  readonly layers: Readonly<Record<LayerType, boolean>>;
  readonly identify: boolean;
  readonly drawTool: boolean;
  readonly geolocation: boolean;
  readonly layerComparison: boolean;
  readonly temporalController: boolean;
}

const MAPLIBRE_FEATURES: IMapAdapterFeature = {
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
  identify: false,
  drawTool: false,
  geolocation: false,
  layerComparison: false,
  temporalController: false,
};

const OPENLAYERS_FEATURES: IMapAdapterFeature = {
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
  identify: true,
  drawTool: true,
  geolocation: true,
  layerComparison: true,
  temporalController: true,
};

export const MAP_ADAPTER_FEATURES: Readonly<
  Record<MapAdapterType, IMapAdapterFeature>
> = {
  maplibre: MAPLIBRE_FEATURES,
  openlayers: OPENLAYERS_FEATURES,
};

/**
 * Get the unsupported reason for a layer or source.
 */
export function getUnsupportedReason(
  features: IMapAdapterFeature,
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
