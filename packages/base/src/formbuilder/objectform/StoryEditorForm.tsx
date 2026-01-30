import { IDict } from '@jupytergis/schema';
import { RJSFSchema, UiSchema } from '@rjsf/utils';

import { getCssVarAsColor } from '@/src/tools';
import { BaseForm } from './baseform';
import { getCssVarAsColor } from '@/src/tools';

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

    uiSchema.presentaionTextColor = {
      'ui:widget': 'color',
    };

    // Set default values from theme CSS variables when not already in data
    const schemaProps = schema.properties as IDict | undefined;
    if (
      schemaProps?.presentationBgColor &&
      data?.presentationBgColor === undefined
    ) {
      const defaultBg = getCssVarAsColor('--jp-layout-color0');
      if (defaultBg) {
        schemaProps.presentationBgColor.default = defaultBg;
      }
    }
    if (
      schemaProps?.presentaionTextColor &&
      data?.presentaionTextColor === undefined
    ) {
      const defaultText = getCssVarAsColor('--jp-ui-font-color0');
      if (defaultText) {
        schemaProps.presentaionTextColor.default = defaultText;
      }
    }
  }
}
