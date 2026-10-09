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
    FeatureStoreSource: false,
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
    FeatureStoreSource: true,
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

interface ILayerEntry {
  label: string;
  layer: LayerType;
  /** Omitted for layers that have no source of their own (e.g. STAC). */
  source?: SourceType;
}

const LAYER_ENTRIES: ILayerEntry[] = [
  // Raster
  { label: 'Raster tiles', layer: 'RasterLayer', source: 'RasterSource' },
  { label: 'WMS', layer: 'RasterLayer', source: 'WmsTileSource' },
  { label: 'Hillshade', layer: 'HillshadeLayer', source: 'RasterDemSource' },
  { label: '3D terrain', layer: 'TerrainLayer', source: 'RasterDemSource' },
  { label: 'Image', layer: 'ImageLayer', source: 'ImageSource' },
  { label: 'GeoTIFF', layer: 'GeoTiffLayer', source: 'GeoTiffSource' },
  { label: 'GeoZarr', layer: 'GeoZarrLayer', source: 'GeoZarrSource' },
  {
    label: 'GeoPackage (raster)',
    layer: 'RasterLayer',
    source: 'GeoPackageRasterSource',
  },
  { label: 'OpenEO', layer: 'OpenEOTileLayer', source: 'OpenEOTileSource' },
  { label: 'STAC', layer: 'StacLayer' },
  // Vector
  {
    label: 'Vector tiles',
    layer: 'VectorTileLayer',
    source: 'VectorTileSource',
  },
  { label: 'GeoJSON', layer: 'VectorLayer', source: 'GeoJSONSource' },
  { label: 'Shapefile', layer: 'VectorLayer', source: 'ShapefileSource' },
  { label: 'GeoParquet', layer: 'VectorLayer', source: 'GeoParquetSource' },
  {
    label: 'GeoPackage (vector)',
    layer: 'VectorLayer',
    source: 'GeoPackageVectorSource',
  },
  {
    label: 'Feature store',
    layer: 'VectorLayer',
    source: 'FeatureStoreSource',
  },
];

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

  return [
    {
      title: 'Layers',
      rows: LAYER_ENTRIES.map(({ label, layer, source }) =>
        row(
          label,
          f => f.layers[layer] && (source === undefined || f.sources[source]),
        ),
      ),
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
