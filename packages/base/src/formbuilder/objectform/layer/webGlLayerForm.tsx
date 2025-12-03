import { IDict } from '@jupytergis/schema';

import { LayerPropertiesForm } from './layerform';
import { ISubmitEvent } from '@rjsf/core';

/**
 * The form to modify a hillshade layer.
 */
export class WebGlLayerPropertiesForm extends LayerPropertiesForm {
  protected onFormSubmit(e: ISubmitEvent<any>): void {
    e.formData.symbologyState = {};

    return super.onFormSubmit(e);
  }

  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict,
  ) {
    this.removeFormEntry('color', data, schema, uiSchema);
    this.removeFormEntry('symbologyState', data, schema, uiSchema);

    super.processSchema(data, schema, uiSchema);
  }
}
