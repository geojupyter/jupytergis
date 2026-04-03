import { IDict } from '@jupytergis/schema';
import * as geojson from '@jupytergis/schema/src/schema/geojson.json';
import { showErrorMessage } from '@jupyterlab/apputils';
import { UiSchema } from '@rjsf/utils';
import { Ajv, type ValidateFunction } from 'ajv';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { deepCopy, loadFile } from '@/src/tools';
import { SchemaForm } from '../SchemaForm';
import { FileSelectorWidget } from '../fileselectorwidget';
import {
  applyProxyFieldVisibility,
  processBaseSchema,
  removeFormEntry,
} from '../schemaUtils';
import { useSchemaFormState } from '../useSchemaFormState';
import type { ISourceFormProps } from './sourceform';

export function GeoJSONSourcePropertiesForm(
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
    formErrorSignal,
    formSchemaRegistry,
    cancel,
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
  const [extraErrors, setExtraErrors] = useState<IDict>({});

  const validateGeoJSON = useMemo((): ValidateFunction => {
    const ajv = new Ajv();
    return ajv.compile(geojson as any);
  }, []);

  const validatePath = useCallback(
    async (path: string | undefined) => {
      const nextErrors: IDict = {};
      let valid = true;
      let error = '';

      if (!path || !path.trim()) {
        valid = false;
        error = 'Path is required';
      } else {
        try {
          const geoJSONData = await loadFile({
            filepath: path,
            type: 'GeoJSONSource',
            model,
          });

          valid = validateGeoJSON(geoJSONData);

          if (!valid) {
            error = `"${path}" is not a valid GeoJSON file`;
          }
        } catch (e) {
          valid = false;
          error = `"${path}" is not a valid GeoJSON file: ${e}`;
        }
      }

      if (!valid) {
        nextErrors.path = { __errors: [error] };

        if (validateGeoJSON.errors?.length) {
          validateGeoJSON.errors.reverse().forEach(err => {
            (nextErrors.path.__errors as string[]).push(err.message ?? '');
          });
        }
      } else {
        nextErrors.path = { __errors: [] };
      }

      setExtraErrors(nextErrors);
      formErrorSignal?.emit(!valid);
    },
    [model, validateGeoJSON, formErrorSignal],
  );

  const uiSchema = useMemo(() => {
    const builtUiSchema: UiSchema = {};
    const dataCopy = deepCopy(formData);

    removeFormEntry('data', dataCopy, schema, builtUiSchema);

    if (formContext === 'create' && schema.properties?.path) {
      (schema.properties.path as IDict).description =
        'The local path to a GeoJSON file. (If no path/url is provided, an empty GeoJSON is created.)';
    }

    processBaseSchema(
      dataCopy,
      schema,
      builtUiSchema,
      formContext,
      removeFormEntry,
    );

    applyProxyFieldVisibility(formData, dataCopy, schema, builtUiSchema);

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

      let submitted = { ...data };

      if (!submitted.path) {
        submitted = {
          ...submitted,
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        };
      }
      handleSubmitBase(submitted);
    },
    [extraErrors, handleSubmitBase],
  );

  useEffect(() => {
    if (formData?.path) {
      validatePath(formData?.path);
    }
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
