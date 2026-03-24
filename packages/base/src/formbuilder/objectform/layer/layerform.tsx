/**
 * Base (default) layer form and props.
 * Used for RasterLayer and any layer type without a dedicated form.
 */
import { IDict, SourceType } from '@jupytergis/schema';
import { Signal } from '@lumino/signaling';
import { UiSchema } from '@rjsf/utils';
import React, { useMemo } from 'react';

import { deepCopy } from '@/src/tools';
import type { IBaseFormProps } from '@/src/types';
import { SchemaForm } from '../SchemaForm';
import { processBaseSchema, removeFormEntry } from '../schemaUtils';
import { useSchemaFormState } from '../useSchemaFormState';

export interface ILayerProps extends IBaseFormProps {
  /**
   * The source type for the layer
   */
  sourceType: SourceType;

  /**
   * The signal emitted when the attached source form has changed, if it exists
   */
  sourceFormChangedSignal?: Signal<any, IDict<any>>;

  /**
   * Configuration options for the dialog, including settings for layer data, source data,
   * and other form-related parameters.
   */
  dialogOptions?: any;
}

export function LayerPropertiesForm(
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
