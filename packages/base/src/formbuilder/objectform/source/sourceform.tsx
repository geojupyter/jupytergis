/**
 * Base (default) source form and props.
 * Used for RasterSource and any source type without a dedicated form.
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

export interface ISourceFormProps extends IBaseFormProps {
  /**
   * The source type for this form.
   */
  sourceType: SourceType;

  /**
   * The signal emitted when the source form has changed.
   */
  sourceFormChangedSignal?: Signal<any, IDict<any>>;

  /**
   * Configuration options for the dialog, including settings for source data and other parameters.
   */
  dialogOptions?: any;
}

export function SourcePropertiesForm(
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
