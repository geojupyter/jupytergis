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
    this.removeFormEntry('storySegments', data, schema, uiSchema);

    uiSchema['presentaionBgColor'] = {
      'ui:widget': 'color',
    };

    uiSchema['presentaionTextColor'] = {
      'ui:widget': 'color',
    };
  }
}
