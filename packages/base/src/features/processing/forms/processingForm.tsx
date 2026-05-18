/**
 * Used by ProcessingFormDialog when processingType is not 'Dissolve'.
 */
import { Dialog } from '@jupyterlab/apputils';
import { Signal } from '@lumino/signaling';
import { UiSchema } from '@rjsf/utils';
import React, { useEffect, useMemo, useRef } from 'react';

import { SchemaForm } from '@/src/formbuilder/objectform/SchemaForm';
import {
  processBaseSchema,
  removeFormEntry,
} from '@/src/formbuilder/objectform/schemaUtils';
import { useSchemaFormState } from '@/src/formbuilder/objectform/useSchemaFormState';
import { deepCopy } from '@/src/tools';
import type { IBaseFormProps } from '@/src/types';

export interface IProcessingFormWrapperProps extends IBaseFormProps {
  /** Signal emitted by the dialog when OK is clicked; form submits when this fires. */
  ok?: Signal<Dialog<any>, number>;
}

export function DefaultProcessingForm(
  props: IProcessingFormWrapperProps,
): React.ReactElement | null {
  const {
    schema: schemaProp,
    sourceData,
    syncData,
    model,
    filePath,
    formContext,
    ok,
  } = props;

  const {
    formData,
    setFormData,
    schema,
    formContextValue,
    hasSchema,
    handleSubmitBase,
  } = useSchemaFormState({ sourceData, schemaProp, model, syncData });
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!ok) {
      return;
    }

    const handler = () => {
      submitButtonRef.current?.click();
    };

    ok.connect(handler);

    return () => {
      ok.disconnect(handler);
    };
  }, [ok]);

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
      onChange={setFormData}
      onSubmit={handleSubmitBase}
      formContext={formContextValue}
      filePath={filePath}
      uiSchema={uiSchema}
      submitButtonRef={submitButtonRef}
    />
  );
}
