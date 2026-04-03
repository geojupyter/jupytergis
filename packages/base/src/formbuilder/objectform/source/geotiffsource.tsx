import { IDict } from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { deepCopy, getMimeType } from '@/src/tools';
import { SchemaForm } from '../SchemaForm';
import { FileSelectorWidget } from '../fileselectorwidget';
import {
  applyProxyFieldVisibility,
  processBaseSchema,
  removeFormEntry,
} from '../schemaUtils';
import { useSchemaFormState } from '../useSchemaFormState';
import type { ISourceFormProps } from './sourceform';

export function GeoTiffSourcePropertiesForm(
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

  const validateUrls = useCallback(
    async (urls: Array<IDict> | undefined, isSubmit: boolean) => {
      const errors: string[] = [];
      let valid = true;

      if (urls && urls.length > 0) {
        for (let i = 0; i < urls.length; i++) {
          const { url, min, max } = urls[i];

          if (isSubmit) {
            const mimeType = getMimeType(url);

            if (!mimeType || !mimeType.startsWith('image/tiff')) {
              valid = false;
              errors.push(`"${url}" is not a valid ${sourceType} file.`);
            }
          } else {
            if (!url || typeof url !== 'string' || url.trim() === '') {
              valid = false;
              errors.push(
                `URL at index ${i} is required and must be a valid string.`,
              );
            }

            if (min === undefined || typeof min !== 'number') {
              errors.push(
                `Min value at index ${i} is required and must be a number.`,
              );
              valid = false;
            }

            if (max === undefined || typeof max !== 'number') {
              errors.push(
                `Max value at index ${i} is required and must be a number.`,
              );
              valid = false;
            }

            if (
              typeof min === 'number' &&
              typeof max === 'number' &&
              max <= min
            ) {
              errors.push(`Max value at index ${i} must be greater than Min.`);
              valid = false;
            }
          }
        }
      } else {
        errors.push('At least one valid URL with min/max values is required.');
        valid = false;
      }

      const nextErrors: IDict = valid
        ? { urls: { __errors: [] } }
        : { urls: { __errors: errors } };

      setExtraErrors(nextErrors);
      formErrorSignal?.emit(!valid);

      return { valid, errors };
    },
    [sourceType, formErrorSignal],
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

    applyProxyFieldVisibility(formData, dataCopy, schema, builtUiSchema);

    const docManager = formSchemaRegistry?.getDocManager();

    if (schema.properties?.urls && docManager) {
      builtUiSchema.urls = {
        ...(builtUiSchema.urls as IDict),
        items: {
          ...(builtUiSchema.urls as IDict)?.items,
          url: {
            'ui:widget': FileSelectorWidget,
            'ui:options': {
              docManager,
              formOptions: props,
            },
          },
        },
      };
    }

    return builtUiSchema;
  }, [schema, formData, formContext, formSchemaRegistry, props]);

  const handleChange = useCallback(
    (data: IDict) => {
      handleChangeBase(data);

      if (data.urls) {
        validateUrls(data.urls, false);
      }
    },
    [handleChangeBase, validateUrls],
  );

  const handleSubmit = useCallback(
    async (data: IDict) => {
      const { valid, errors } = await validateUrls(data.urls, true);

      if (!valid) {
        if (errors.length > 0) {
          showErrorMessage('Invalid URLs', errors[0]);
        }

        return;
      }

      handleSubmitBase(data);
    },
    [validateUrls, handleSubmitBase],
  );

  useEffect(() => {
    validateUrls(formData?.urls, false);
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
