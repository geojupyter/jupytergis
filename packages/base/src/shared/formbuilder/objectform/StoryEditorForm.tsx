import { UiSchema } from '@rjsf/utils';
import React, { useMemo } from 'react';

import { deepCopy } from '@/src/tools';
import type { IBaseFormProps } from '@/src/types';
import { SchemaForm } from './SchemaForm';
import { processBaseSchema, removeFormEntry } from './schemaUtils';
import { useSchemaFormState } from './useSchemaFormState';

export function StoryEditorPropertiesForm(
  props: IBaseFormProps,
): React.ReactElement | null {
  const {
    schema: schemaProp,
    sourceData,
    syncData,
    model,
    filePath,
    formContext,
    cancel,
  } = props;

  const {
    formData,
    schema,
    formContextValue,
    hasSchema,
    handleChangeBase,
    handleSubmitBase,
  } = useSchemaFormState({ sourceData, schemaProp, model, syncData, cancel });

  const uiSchema = useMemo(() => {
    const builtUiSchema: UiSchema = {};
    const dataCopy = deepCopy(formData);
    removeFormEntry('storySegments', dataCopy, schema, builtUiSchema);
    processBaseSchema(
      dataCopy,
      schema,
      builtUiSchema,
      formContext,
      removeFormEntry,
    );
    builtUiSchema.presentationBgColor = { 'ui:widget': 'color' };
    builtUiSchema.presentationTextColor = { 'ui:widget': 'color' };

    return builtUiSchema;
  }, [schema, formData, formContext]);

  if (!hasSchema) {
    return null;
  }

  return (
    <SchemaForm
      schema={schema}
      formData={formData}
      onChange={handleChangeBase}
      onSubmit={handleSubmitBase}
      formContext={formContextValue}
      filePath={filePath}
      uiSchema={uiSchema}
    />
  );
}
