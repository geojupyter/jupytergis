import { LayerType, SourceType } from '@jupytergis/schema';
import { BaseForm } from './objectform/baseform';
import { COGSourcePropertiesForm } from './objectform/cogsourceform';
import { GeoJSONSourcePropertiesForm } from './objectform/geojsonsource';
import { TileSourcePropertiesForm } from './objectform/tilesourceform';
import { VectorLayerPropertiesForm } from './objectform/vectorlayerform';
import { LayerPropertiesForm } from './objectform/layerform';
import { COGLayerPropertiesForm } from './objectform/coglayerform';

export function getLayerTypeForm(
  layerType: LayerType
): typeof LayerPropertiesForm {
  let LayerForm = LayerPropertiesForm;

  switch (layerType) {
    case 'VectorLayer':
      LayerForm = VectorLayerPropertiesForm;
      break;
    case 'COGLayer':
      LayerForm = COGLayerPropertiesForm;
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
    case 'COGSource':
      SourceForm = COGSourcePropertiesForm;
      break;
    case 'RasterSource':
    case 'VectorTileSource':
      SourceForm = TileSourcePropertiesForm;
      break;
    // ADD MORE FORM TYPES HERE
  }

  return SourceForm;
}
