import { IDict } from '@jupytergis/schema';
import { UiSchema } from '@rjsf/utils';
import React, { useMemo } from 'react';

import { deepCopy } from '@/src/tools';
import { SchemaForm } from '../SchemaForm';
import {
  processBaseSchema,
  removeFormEntry,
} from '../schemaUtils';
import { useSchemaFormState } from '../useSchemaFormState';
import type { ISourceFormProps } from './sourceform';

function getUrlParameters(url: string | undefined): string[] {
  if (!url || typeof url !== 'string') {
    return [];
  }

  const regex = /\{([^}]+)\}/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(url)) !== null) {
    if (['max_zoom', 'min_zoom', 'x', 'y', 'z'].includes(match[1])) {
      continue;
    }
    matches.push(match[1]);
  }

  return matches;
}

export function TileSourcePropertiesForm(
  props: ISourceFormProps,
): React.ReactElement | null {
  const {
    schema: schemaProp,
    sourceData,
    syncData,
    model,
    filePath,
    formContext,
    dialogOptions,
    cancel,
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
    cancel,
    onAfterChange: dialogOptions
      ? (data: IDict) => {
          dialogOptions.sourceData = { ...data };
        }
      : undefined,
  });

  const uiSchema = useMemo(() => {
    const builtUiSchema: UiSchema = {};
    const dataCopy = deepCopy(formData);
    processBaseSchema(
      dataCopy,
      schema,
      builtUiSchema,
      formContext,
      removeFormEntry,
    );

    if (schema.properties && formData?.url) {
      const urlParams = getUrlParameters(formData.url);

      if (urlParams.length === 0) {
        removeFormEntry('urlParameters', dataCopy, schema, builtUiSchema);
      } else {
        const propertiesSchema: { [name: string]: any } = {};

        (schema.properties as IDict).urlParameters = {
          type: 'object',
          required: urlParams,
          properties: propertiesSchema,
        };

        for (const parameterName of urlParams) {
          if (parameterName === 'time') {
            propertiesSchema[parameterName] = {
              type: 'string',
              format: 'date',
            };
          } else {
            propertiesSchema[parameterName] = { type: 'string' };
          }
        }
      }
    }

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
      formErrorSignal={formErrorSignal}
    />
  );
}
