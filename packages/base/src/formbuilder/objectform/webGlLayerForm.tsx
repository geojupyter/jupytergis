import { IDict } from '@jupytergis/schema';
import { LayerPropertiesForm } from './layerform';

/**
 * The form to modify a hillshade layer.
 */
export class WebGlLayerPropertiesForm extends LayerPropertiesForm {
  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    this.removeFormEntry('color', data, schema, uiSchema);
    super.processSchema(data, schema, uiSchema);
  }
}
