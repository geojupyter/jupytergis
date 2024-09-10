import { LayerType, SourceType } from '@jupytergis/schema';
import { BaseForm } from './objectform/baseform';
import { GeoJSONSourcePropertiesForm } from './objectform/geojsonsource';
import { HillshadeLayerPropertiesForm } from './objectform/hillshadeLayerForm';
import { LayerPropertiesForm } from './objectform/layerform';
import { TileSourcePropertiesForm } from './objectform/tilesourceform';
import { VectorLayerPropertiesForm } from './objectform/vectorlayerform';

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
    case 'RasterSource':
    case 'VectorTileSource':
      SourceForm = TileSourcePropertiesForm;
      break;
    // ADD MORE FORM TYPES HERE
  }

  return SourceForm;
}
