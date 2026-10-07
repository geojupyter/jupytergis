import type {
  IJGISLayer,
  IJGISSource,
  IJupyterGISModel,
  LayerType,
  SourceType,
  IMapAdapterType,
} from '@jupytergis/schema';

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
  Record<IMapAdapterType, IMapAdapterFeatures>
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

const LAYER_LABELS: Record<LayerType, string> = {
  RasterLayer: 'Raster',
  VectorLayer: 'Vector (GeoJSON, Shapefile, GeoParquet, GeoPackage)',
  VectorTileLayer: 'Vector tiles',
  HillshadeLayer: 'Hillshade',
  TerrainLayer: '3D terrain',
  GeoTiffLayer: 'GeoTIFF',
  GeoZarrLayer: 'GeoZarr',
  ImageLayer: 'Image',
  StacLayer: 'STAC',
  StorySegmentLayer: 'Story segment',
  OpenEOTileLayer: 'OpenEO',
};

const SOURCE_LABELS: Record<SourceType, string> = {
  RasterSource: 'Raster tiles',
  WmsTileSource: 'WMS',
  VectorTileSource: 'Vector tiles',
  GeoJSONSource: 'GeoJSON',
  RasterDemSource: 'Elevation (DEM) tiles',
  ImageSource: 'Image',
  ShapefileSource: 'Shapefile',
  GeoTiffSource: 'GeoTIFF',
  GeoZarrSource: 'GeoZarr',
  GeoPackageVectorSource: 'GeoPackage (vector)',
  GeoPackageRasterSource: 'GeoPackage (raster)',
  GeoParquetSource: 'GeoParquet',
  MarkerSource: 'Markers',
  OpenEOTileSource: 'OpenEO',
};

type ToolKey =
  | 'addMarker'
  | 'identify'
  | 'drawTool'
  | 'layerComparison'
  | 'geolocation';

const TOOL_LABELS: Record<ToolKey, string> = {
  addMarker: 'Place markers',
  identify: 'Identify features',
  drawTool: 'Drawing tools',
  layerComparison: 'Layer swipe comparison',
  geolocation: 'Geolocation',
} as const;

export interface ISupportRow {
  label: string;
  support: Record<IMapAdapterType, boolean>;
}

export interface ISupportGroup {
  title: string;
  rows: ISupportRow[];
}

/** Rows for the "compare renderers" table, built from MAP_ADAPTER_FEATURES. */
export function getSupportTable(): ISupportGroup[] {
  const types = Object.keys(MAP_ADAPTER_FEATURES) as IMapAdapterType[];

  const row = (
    label: string,
    pick: (features: IMapAdapterFeatures) => boolean,
  ): ISupportRow => ({
    label,
    support: Object.fromEntries(
      types.map(type => [type, pick(MAP_ADAPTER_FEATURES[type])]),
    ) as Record<IMapAdapterType, boolean>,
  });

  // Not shown: story segments are never rendered (always "supported"), and the
  // marker source is covered by the "Place markers" tool row.
  const hiddenLayers: LayerType[] = ['StorySegmentLayer'];
  const hiddenSources: SourceType[] = ['MarkerSource'];

  return [
    {
      title: 'Layers',
      rows: (Object.keys(LAYER_LABELS) as LayerType[])
        .filter(key => !hiddenLayers.includes(key))
        .map(key => row(LAYER_LABELS[key], f => f.layers[key])),
    },
    {
      title: 'Sources',
      rows: (Object.keys(SOURCE_LABELS) as SourceType[])
        .filter(key => !hiddenSources.includes(key))
        .map(key => row(SOURCE_LABELS[key], f => f.sources[key])),
    },
    {
      title: 'Tools',
      rows: (Object.keys(TOOL_LABELS) as ToolKey[]).map(key =>
        row(TOOL_LABELS[key], f => f[key]),
      ),
    },
  ];
}

/** Layers in the document that `target` would not be able to render. */
export function getLayersUnsupportedBy(
  model: IJupyterGISModel,
  target: IMapAdapterType,
): Array<{ id: string; name: string; reason: string }> {
  const features = MAP_ADAPTER_FEATURES[target];
  const skipped: Array<{ id: string; name: string; reason: string }> = [];

  for (const [id, layer] of Object.entries(model.getLayers())) {
    const sourceId = (layer.parameters as { source?: string } | undefined)
      ?.source;
    const source = sourceId ? model.getSource(sourceId) : undefined;
    const reason = getUnsupportedReason(features, layer, source);
    if (reason) {
      skipped.push({ id, name: layer.name, reason });
    }
  }

  return skipped;
}
