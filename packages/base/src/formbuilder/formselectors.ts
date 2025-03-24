import { LayerType, SourceType } from '@jupytergis/schema';
import { GeoJSONSourcePropertiesForm } from './objectform/source';
import { GeoTiffSourcePropertiesForm } from './objectform/source';
import { HeatmapLayerPropertiesForm } from './objectform/layer';
import { HillshadeLayerPropertiesForm } from './objectform/layer';
import { LayerPropertiesForm } from './objectform/layer';
import { PathBasedSourcePropertiesForm } from './objectform/source';
import { TileSourcePropertiesForm } from './objectform/source';
import { VectorLayerPropertiesForm } from './objectform/layer';
import { WebGlLayerPropertiesForm } from './objectform/layer';
import { SourcePropertiesForm } from './objectform/source';

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
