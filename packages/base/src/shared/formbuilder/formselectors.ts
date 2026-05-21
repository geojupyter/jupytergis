import { LayerType, SourceType } from '@jupytergis/schema';
import * as React from 'react';

import {
  HeatmapLayerPropertiesForm,
  HillshadeLayerPropertiesForm,
  StorySegmentLayerPropertiesForm,
  LayerPropertiesForm,
  VectorLayerPropertiesForm,
  GeoTiffLayerPropertiesForm,
} from '@/src/features/layers/forms/layer';
import type { ILayerProps } from '@/src/features/layers/forms/layer/layerform';
import {
  GeoJSONSourcePropertiesForm,
  GeoTiffSourcePropertiesForm,
  PathBasedSourcePropertiesForm,
  TileSourcePropertiesForm,
  WmsTileSourceForm,
  SourcePropertiesForm,
  GeoPackagePropertiesForm,
} from '@/src/features/layers/forms/source';
import type { ISourceFormProps } from '@/src/features/layers/forms/source/sourceform';

export function getLayerTypeForm(
  layerType: LayerType,
): React.ComponentType<ILayerProps> {
  let LayerForm: React.ComponentType<ILayerProps> = LayerPropertiesForm;

  switch (layerType) {
    case 'VectorTileLayer':
    case 'VectorLayer':
      LayerForm = VectorLayerPropertiesForm;
      break;
    case 'HillshadeLayer':
      LayerForm = HillshadeLayerPropertiesForm;
      break;
    case 'GeoTiffLayer':
      LayerForm = GeoTiffLayerPropertiesForm;
      break;
    case 'HeatmapLayer':
      LayerForm = HeatmapLayerPropertiesForm;
      break;
    case 'StorySegmentLayer':
      LayerForm = StorySegmentLayerPropertiesForm;
      break;

    // ADD MORE FORM TYPES HERE
  }

  return LayerForm;
}

export function getSourceTypeForm(
  sourceType: SourceType,
): React.ComponentType<ISourceFormProps> {
  let SourceForm: React.ComponentType<ISourceFormProps> = SourcePropertiesForm;

  switch (sourceType) {
    case 'GeoJSONSource':
      SourceForm = GeoJSONSourcePropertiesForm;
      break;
    case 'ImageSource':
      SourceForm = PathBasedSourcePropertiesForm;
      break;
    case 'ShapefileSource':
      SourceForm = PathBasedSourcePropertiesForm;
      break;
    case 'GeoTiffSource':
      SourceForm = GeoTiffSourcePropertiesForm;
      break;
    case 'WmsTileSource':
      SourceForm = WmsTileSourceForm;
      break;
    case 'RasterSource':
    case 'VectorTileSource':
      SourceForm = TileSourcePropertiesForm;
      break;
    case 'GeoPackageVectorSource':
      SourceForm = GeoPackagePropertiesForm;
      break;
    case 'GeoPackageRasterSource':
      SourceForm = GeoPackagePropertiesForm;
      break;
    case 'GeoParquetSource':
      SourceForm = PathBasedSourcePropertiesForm;
      break;

    // ADD MORE FORM TYPES HERE
  }
  return SourceForm;
}
