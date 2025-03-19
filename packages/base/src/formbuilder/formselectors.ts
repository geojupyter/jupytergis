import { LayerType, SourceType } from '@jupytergis/schema';
import { GeoJSONSourcePropertiesForm } from './objectform/geojsonsource';
import { GeoTiffSourcePropertiesForm } from './objectform/geotiffsource';
import { HeatmapLayerPropertiesForm } from './objectform/heatmapLayerForm';
import { HillshadeLayerPropertiesForm } from './objectform/hillshadeLayerForm';
import { LayerPropertiesForm } from './objectform/layerform';
import { PathBasedSourcePropertiesForm } from './objectform/pathbasedsource';
import { TileSourcePropertiesForm } from './objectform/tilesourceform';
import { VectorLayerPropertiesForm } from './objectform/vectorlayerform';
import { WebGlLayerPropertiesForm } from './objectform/webGlLayerForm';
import { SourcePropertiesForm } from './objectform/sourceform';

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

export function getSourceTypeForm(sourceType: SourceType): typeof SourcePropertiesForm {
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
