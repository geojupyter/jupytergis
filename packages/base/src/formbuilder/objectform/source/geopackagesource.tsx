import { IDict } from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { deepCopy } from '@/src/tools';
import { SchemaForm } from '../SchemaForm';
import { FileSelectorWidget } from '../fileselectorwidget';
import { processBaseSchema, removeFormEntry } from '../schemaUtils';
import { useSchemaFormState } from '../useSchemaFormState';
import type { ISourceFormProps } from './sourceform';

export function GeoPackagePropertiesForm(
  props: ISourceFormProps,
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
    formSchemaRegistry,
    cancel,
  } = props;

  const {
    formData,
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

  const [extraErrors, setExtraErrors] = useState<IDict>({});

  const validatePath = useCallback(
    (path: string) => {
      const nextErrors: IDict = {};
      let valid = true;
      let error = '';

      if (!path) {
        valid = false;
        error = 'Path is required';
      } else {
        const isUrl = path.startsWith('http://') || path.startsWith('https://');
        if (!isUrl && !path.toLowerCase().endsWith('.gpkg')) {
          valid = false;
          error = `"${path}" does not appear to be a GeoPackage file (.gpkg).`;
        }
      }

      if (!valid) {
        nextErrors.path = { __errors: [error] };
      } else {
        nextErrors.path = { __errors: [] };
      }

      setExtraErrors(nextErrors);
      formErrorSignal?.emit(!valid);
    },
    [formErrorSignal],
  );

  const schema = useMemo(() => {
    const schemaCopy = deepCopy(schemaProp ?? {}) as RJSFSchema;

    if (schemaCopy.properties) {
      delete (schemaCopy.properties as IDict).valid;
    }

    return schemaCopy;
  }, [schemaProp]);

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

    const docManager = formSchemaRegistry?.getDocManager();

    if (schema.properties?.path && docManager) {
      builtUiSchema.path = {
        'ui:widget': FileSelectorWidget,
        'ui:options': {
          docManager,
          formOptions: {
            ...props,
            sourceType,
          },
        },
      };
    }

    return builtUiSchema;
  }, [schema, formData, formContext, formSchemaRegistry, props, sourceType]);

  const handleChange = useCallback(
    (data: IDict) => {
      handleChangeBase(data);

      if (data.path !== undefined) {
        validatePath(data.path);
      }
    },
    [handleChangeBase, validatePath],
  );

  const handleSubmit = useCallback(
    (data: IDict) => {
      if (extraErrors?.path?.__errors?.length >= 1) {
        showErrorMessage('Invalid file', extraErrors.path.__errors[0]);
        return;
      }

      handleSubmitBase(data);
    },
    [extraErrors, handleSubmitBase],
  );

  useEffect(() => {
    validatePath(formData?.path ?? '');
  }, []);

  if (!hasSchema) {
    return null;
  }

  return (
    <SchemaForm
      schema={schema}
      formData={formData}
      onChange={handleChange}
      onSubmit={handleSubmit}
      formContext={formContextValue}
      filePath={filePath}
      uiSchema={uiSchema}
      extraErrors={extraErrors}
      formErrorSignal={formErrorSignal}
    />
  );
}
