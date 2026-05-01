import { IDict } from '@jupytergis/schema';
import { UiSchema } from '@rjsf/utils';
import React, { useMemo } from 'react';

import { SchemaForm } from '@/src/formbuilder/objectform/SchemaForm';
import {
  processBaseSchema,
  removeFormEntry,
} from '@/src/formbuilder/objectform/schemaUtils';
import { useSchemaFormState } from '@/src/formbuilder/objectform/useSchemaFormState';
import { deepCopy } from '@/src/tools';
import type { ILayerProps } from './layerform';

export function GeoTiffLayerPropertiesForm(
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
    const builtUiSchema: UiSchema = {};
    const dataCopy = deepCopy(formData);

    removeFormEntry('color', formData, schema, builtUiSchema);
    removeFormEntry('symbologyState', formData, schema, builtUiSchema);

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
