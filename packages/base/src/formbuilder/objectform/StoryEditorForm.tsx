import { IDict } from '@jupytergis/schema';
import { RJSFSchema, UiSchema } from '@rjsf/utils';

import { BaseForm } from './baseform';

/**
 * The form to modify story map properties.
 */
export class StoryEditorPropertiesForm extends BaseForm {
  protected processSchema(
    data: IDict<any> | undefined,
    schema: RJSFSchema,
    uiSchema: UiSchema,
  ): void {
    super.processSchema(data, schema, uiSchema);
    this.removeFormEntry('storySegments', data, schema, uiSchema);

    uiSchema.presentationBgColor = {
      'ui:widget': 'color',
    };

    uiSchema.presentationTextColor = {
      'ui:widget': 'color',
    };
  }
}
