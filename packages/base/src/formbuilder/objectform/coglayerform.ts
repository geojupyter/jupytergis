import { IDict } from '@jupytergis/schema';
import { LayerPropertiesForm } from './layerform';
import { cogTile } from '../../cog';

/**
 * The form to modify a COG layer.
 */
export class COGLayerPropertiesForm extends LayerPropertiesForm {
  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    super.processSchema(data, schema, uiSchema);

    // url cannot be set manually, it's computed by titiler
    this.removeFormEntry('url', data, schema, uiSchema);

    const sourceBands = this.props.currentLayerSourceFormData.bands;
    if (sourceBands) {
      schema.properties.bands.items.enumNames = sourceBands;
      schema.properties.bands.items.enum = sourceBands;

      // Colormap can only be set for single band images
      if (sourceBands.length !== 1) {
        this.removeFormEntry('colormap', data, schema, uiSchema);
      }

      // Set bands values automatically if we can
      !data && (data = {});
      !data.bands && (data.bands = []);
      !data.bands[0] && sourceBands[0] && (data.bands[0] = sourceBands[0]);
      !data.bands[1] && sourceBands[1] && (data.bands[1] = sourceBands[1]);
      !data.bands[2] && sourceBands[2] && (data.bands[2] = sourceBands[2]);
    }
  }

  protected syncData(properties: IDict<any> | undefined) {
    if (!properties) {
      return;
    }

    // TODO Compute this stupid bidx properly (indexing starts at 1 -_-)
    const sourceBands = this.props.currentLayerSourceFormData.bands as string[];
    const params: IDict = {};

    params.url = this.props.currentLayerSourceFormData.url;

    if (properties.bands) {
      params.bidx = [
        sourceBands.indexOf(properties.bands[0]) + 1,
        sourceBands.indexOf(properties.bands[1]) + 1,
        sourceBands.indexOf(properties.bands[2]) + 1
      ];
    }

    if (properties.colormap) {
      params.colormap_name = properties.colormap;
    }

    properties.url = cogTile(params);

    return super.syncData(properties);
  }
}
