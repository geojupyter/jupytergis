import { IDict } from '@jupytergis/schema';
import { LayerPropertiesForm } from './layerform';

/**
 * The form to modify a vector layer.
 */
export class VectorLayerPropertiesForm extends LayerPropertiesForm {
  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    super.processSchema(data, schema, uiSchema);
    uiSchema['color'] = {
      'ui:widget': 'color'
    };
  }
}
