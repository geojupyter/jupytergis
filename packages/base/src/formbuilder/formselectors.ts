import { LayerType, SourceType } from '@jupytergis/schema';
import { BaseForm } from './objectform/baseform';
import { GeoJSONSourcePropertiesForm } from './objectform/geojsonsource';
import { HillshadeLayerPropertiesForm } from './objectform/hillshadeLayerForm';
import { LayerPropertiesForm } from './objectform/layerform';
import { TileSourcePropertiesForm } from './objectform/tilesourceform';
import { VectorLayerPropertiesForm } from './objectform/vectorlayerform';
import { WebGlLayerPropertiesForm } from './objectform/webGlLayerForm';
import { GeoTiffSourcePropertiesForm } from './objectform/geotiffsource';
import { PathBasedSourcePropertiesForm } from './objectform/pathbasedsource';

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
    // ADD MORE FORM TYPES HERE
  }

  return LayerForm;
}

export function getSourceTypeForm(sourceType: SourceType): typeof BaseForm {
  let SourceForm = BaseForm;
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
