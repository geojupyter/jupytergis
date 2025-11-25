import { IDict } from '@jupytergis/schema';

import { BaseForm } from './baseform';

/**
 * The form to modify a hillshade layer.
 */
export class StoryEditorPropertiesForm extends BaseForm {
  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict,
  ) {
    super.processSchema(data, schema, uiSchema);
    this.removeFormEntry('landmarks', data, schema, uiSchema);
  }
}
