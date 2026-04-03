/**
 * Helpers for adapting JSON Schema and uiSchema before passing them to SchemaForm.
 * Used by layer, source, and other object forms to hide fields, set array options,
 * and apply read-only behaviour based on form context (create vs update).
 */
import { RJSFSchema, UiSchema } from '@rjsf/utils';

import { IDict } from '@/src/types';

/**
 * Remove a property from form data, schema, and uiSchema.
 */
export function removeFormEntry(
  entry: string,
  data: IDict | undefined,
  schema: RJSFSchema,
  uiSchema: UiSchema,
): void {
  if (data) {
    delete data[entry];
  }
  if (schema.properties) {
    delete schema.properties[entry];
  }
  delete uiSchema[entry];
  if (schema.required && schema.required.includes(entry)) {
    schema.required.splice(schema.required.indexOf(entry), 1);
  }
}

/**
 * Remove httpHeaders from the form entirely unless useProxy is enabled.
 */
export function applyProxyFieldVisibility(
  formData: IDict | undefined,
  data: IDict | undefined,
  schema: RJSFSchema,
  uiSchema: UiSchema,
): void {
  if (!formData?.useProxy) {
    removeFormEntry('httpHeaders', data, schema, uiSchema);
  }
}

/**
 * Apply base processSchema: array options, opacity field, readOnly handling.
 * Mutates schema, uiSchema, and optionally data (for readOnly removal in update).
 */
export function processBaseSchema(
  data: IDict | undefined,
  schema: RJSFSchema,
  uiSchema: UiSchema,
  formContext: 'create' | 'update',
  removeEntry: typeof removeFormEntry,
): void {
  if (!schema['properties']) {
    return;
  }

  const props = schema.properties as IDict;
  for (const [k, v] of Object.entries(props)) {
    uiSchema[k] = uiSchema[k] ?? {};

    if (v && typeof v === 'object' && v['type'] === 'array') {
      (uiSchema[k] as IDict)['ui:options'] = {
        orderable: false,
        removable: false,
        addable: false,
        ...((uiSchema[k] as IDict)['ui:options'] ?? {}),
      };
      const items = v['items'];
      if (
        items &&
        typeof items === 'object' &&
        (items as IDict)['type'] === 'array'
      ) {
        (uiSchema[k] as IDict).items = {
          'ui:options': {
            orderable: false,
            removable: false,
            addable: false,
          },
          ...((uiSchema[k] as IDict).items ?? {}),
        };
      }
    }

    if (
      v &&
      typeof v === 'object' &&
      v['type'] === 'object' &&
      (v as IDict).properties
    ) {
      processBaseSchema(
        data?.[k],
        v as RJSFSchema,
        (uiSchema[k] as UiSchema) ?? {},
        formContext,
        removeEntry,
      );
    }

    if (k === 'opacity') {
      (uiSchema[k] as IDict)['ui:field'] = 'opacity';
    }

    if (v && typeof v === 'object' && (v as IDict)['readOnly']) {
      if (formContext === 'create') {
        delete (v as IDict)['readOnly'];
      }
      if (formContext === 'update') {
        removeEntry(k, data, schema, uiSchema);
      }
    }
  }
}
