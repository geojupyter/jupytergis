import { IDict } from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { deepCopy, loadFile } from '@/src/tools';
import { SchemaForm } from '../SchemaForm';
import { FileSelectorWidget } from '../fileselectorwidget';
import { processBaseSchema, removeFormEntry } from '../schemaUtils';
import { useSchemaFormState } from '../useSchemaFormState';
import type { ISourceFormProps } from './sourceform';

export function PathBasedSourcePropertiesForm(
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
    async (path: string) => {
      const nextErrors: IDict = {};
      let valid = true;
      let error = '';

      if (!path) {
        valid = false;
        error = 'Path is required';
      } else {
        try {
          await loadFile({
            filepath: path,
            type: sourceType,
            model,
          });
        } catch (e) {
          valid = false;
          error = `"${path}" is not a valid ${sourceType} file.`;
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
    [model, sourceType, formErrorSignal],
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
          formOptions: props,
        },
      };
    }

    return builtUiSchema;
  }, [schema, formData, formContext, formSchemaRegistry, props]);

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
    />
  );
}
