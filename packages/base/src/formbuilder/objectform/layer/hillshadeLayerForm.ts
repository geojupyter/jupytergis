import { IDict } from '@jupytergis/schema';

import { LayerPropertiesForm } from './layerform';

/**
 * The form to modify a hillshade layer.
 */
export class HillshadeLayerPropertiesForm extends LayerPropertiesForm {
  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    super.processSchema(data, schema, uiSchema);
    uiSchema['shadowColor'] = {
      'ui:widget': 'color'
    };
  }
}
