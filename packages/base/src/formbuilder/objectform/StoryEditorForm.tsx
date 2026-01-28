import { IDict } from '@jupytergis/schema';
import { RJSFSchema, UiSchema } from '@rjsf/utils';

import { BaseForm } from './baseform';

/** Read a CSS variable from the document root and return the value. */
function getCssVarAsColor(cssVar: string): string {
  if (typeof document === 'undefined') {
    return '';
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar)
    .trim();
  if (!value) {
    return '';
  }

  return value;
}

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

    uiSchema.presentaionBgColor = {
      'ui:widget': 'color',
    };

    uiSchema.presentaionTextColor = {
      'ui:widget': 'color',
    };

    // Set default values from theme CSS variables when not already in data
    const schemaProps = schema.properties as IDict | undefined;
    if (schemaProps?.presentaionBgColor && data?.presentaionBgColor === undefined) {
      const defaultBg = getCssVarAsColor('--jp-layout-color0');
      if (defaultBg) {
        schemaProps.presentaionBgColor.default = defaultBg;
      }
    }
    if (schemaProps?.presentaionTextColor && data?.presentaionTextColor === undefined) {
      const defaultText = getCssVarAsColor('--jp-ui-font-color0');
      if (defaultText) {
        schemaProps.presentaionTextColor.default = defaultText;
      }
    }
  }
}
