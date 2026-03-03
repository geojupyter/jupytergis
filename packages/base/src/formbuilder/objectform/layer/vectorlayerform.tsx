import { IDict } from '@jupytergis/schema';
import { UiSchema } from '@rjsf/utils';
import React, { useMemo } from 'react';

import { deepCopy } from '@/src/tools';
import { SchemaForm } from '../SchemaForm';
import { processBaseSchema, removeFormEntry } from '../schemaUtils';
import { useSchemaFormState } from '../useSchemaFormState';
import type { ILayerProps } from './layerform';

export function VectorLayerPropertiesForm(
  props: ILayerProps,
): React.ReactElement | null {
  const {
    schema: schemaProp,
    sourceData,
    syncData,
    model,
    filePath,
    formContext,
    sourceType,
    dialogOptions,
    formErrorSignal,
  } = props;

  const {
    formData,
    schema,
    formContextValue,
    hasSchema,
    handleChangeBase,
    handleSubmitBase,
  } = useSchemaFormState({
    sourceData,
    schemaProp,
    model,
    syncData,
    cancel: props.cancel,
    onAfterChange: dialogOptions
      ? (data: IDict) => {
          dialogOptions.layerData = { ...data };
        }
      : undefined,
  });

  const uiSchema = useMemo(() => {
    const builtUiSchema: UiSchema = {
      color: { 'ui:field': 'hidden' },
      symbologyState: { 'ui:field': 'hidden' },
    };
    const dataCopy = deepCopy(formData);

    processBaseSchema(
      dataCopy,
      schema,
      builtUiSchema,
      formContext,
      removeFormEntry,
    );

    if (schema.properties?.source) {
      const availableSources = model.getSourcesByType(sourceType);
      (schema.properties.source as IDict).enumNames =
        Object.values(availableSources);
      (schema.properties.source as IDict).enum = Object.keys(availableSources);
    }

    return builtUiSchema;
  }, [schema, formData, formContext, model, sourceType]);

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
      formErrorSignal={formErrorSignal}
    />
  );
}
