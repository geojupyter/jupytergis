import { LayerType, SourceType } from '@jupytergis/schema';
import { GeoJSONSourcePropertiesForm } from './objectform/sourceform/geojsonsource';
import { GeoTiffSourcePropertiesForm } from './objectform/sourceform/geotiffsource';
import { HeatmapLayerPropertiesForm } from './objectform/layerform/heatmapLayerForm';
import { HillshadeLayerPropertiesForm } from './objectform/layerform/hillshadeLayerForm';
import { LayerPropertiesForm } from './objectform/layerform/layerform';
import { PathBasedSourcePropertiesForm } from './objectform/sourceform/pathbasedsource';
import { TileSourcePropertiesForm } from './objectform/sourceform/tilesourceform';
import { VectorLayerPropertiesForm } from './objectform/layerform/vectorlayerform';
import { WebGlLayerPropertiesForm } from './objectform/layerform/webGlLayerForm';
import { SourcePropertiesForm } from './objectform/sourceform/sourceform';

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
