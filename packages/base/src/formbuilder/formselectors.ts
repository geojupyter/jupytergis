import { LayerType, SourceType } from '@jupytergis/schema';
import {
  GeoJSONSourcePropertiesForm,
  GeoTiffSourcePropertiesForm,
  PathBasedSourcePropertiesForm,
  TileSourcePropertiesForm,
  SourcePropertiesForm
} from './objectform/source';
import {
  HeatmapLayerPropertiesForm,
  HillshadeLayerPropertiesForm,
  LayerPropertiesForm,
  VectorLayerPropertiesForm,
  WebGlLayerPropertiesForm
} from './objectform/layer';

export function getLayerTypeForm(
  layerType: LayerType
): typeof LayerPropertiesForm {
  let LayerForm = LayerPropertiesForm;

  switch (layerType) {
    case 'VectorTileLayer':
    case 'VectorLayer':
      LayerForm = VectorLayerPropertiesForm;
      break;
    case 'HillshadeLayer':
      LayerForm = HillshadeLayerPropertiesForm;
      break;
    case 'WebGlLayer':
      LayerForm = WebGlLayerPropertiesForm;
      break;
    case 'HeatmapLayer':
      LayerForm = HeatmapLayerPropertiesForm;
    // ADD MORE FORM TYPES HERE
  }

  return LayerForm;
}

export function getSourceTypeForm(
  sourceType: SourceType
): typeof SourcePropertiesForm {
  let SourceForm = SourcePropertiesForm;
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
    case 'RasterSource':
    case 'VectorTileSource':
      SourceForm = TileSourcePropertiesForm;
      break;
    case 'GeoParquetSource':
      SourceForm = PathBasedSourcePropertiesForm;
      break;

    // ADD MORE FORM TYPES HERE
  }
  return SourceForm;
}
