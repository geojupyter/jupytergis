import { LayerType, SourceType } from '@jupytergis/schema';
import { GeoJSONSourcePropertiesForm } from './objectform/sourceforms';
import { GeoTiffSourcePropertiesForm } from './objectform/sourceforms';
import { HeatmapLayerPropertiesForm } from './objectform/layerforms';
import { HillshadeLayerPropertiesForm } from './objectform/layerforms';
import { LayerPropertiesForm } from './objectform/layerforms';
import { PathBasedSourcePropertiesForm } from './objectform/sourceforms';
import { TileSourcePropertiesForm } from './objectform/sourceforms';
import { VectorLayerPropertiesForm } from './objectform/layerforms';
import { WebGlLayerPropertiesForm } from './objectform/layerforms';
import { SourcePropertiesForm } from './objectform/sourceforms';

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
    // ADD MORE FORM TYPES HERE
  }
  return SourceForm;
}
