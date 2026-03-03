import { FormComponent } from '@jupyterlab/ui-components';
import type { Signal } from '@lumino/signaling';
import { IChangeEvent, ISubmitEvent } from '@rjsf/core';
import { RegistryFieldsType, RJSFSchema, UiSchema } from '@rjsf/utils';
import validatorAjv8 from '@rjsf/validator-ajv8';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { IDict, type IJupyterGISFormContext } from '@/src/types';
import HiddenField from './components/HiddenField';
import { LayerSelect } from './components/LayerSelect';
import OpacitySlider from './components/OpacitySlider';

const defaultFields: RegistryFieldsType = {
  opacity: OpacitySlider,
  layerSelect: LayerSelect,
  hidden: HiddenField,
};

export interface ISchemaFormProps {
  /** JSON Schema for the form. */
  schema: IDict;
  /** Current form data (controlled). */
  formData: IDict | undefined;
  /** Called when form data changes. */
  onChange: (data: IDict) => void;
  /** Called when form is submitted (e.g. submit button or Enter). */
  onSubmit: (data: IDict) => void;
  /** Context for custom fields (e.g. LayerSelect) that need model and formData. */
  formContext: IJupyterGISFormContext;
  /** Path to the file; used for data-path on the panel. */
  filePath?: string;
  /** Enable live validation. Default true. */
  liveValidate?: boolean;
  /** Additional custom fields to register (merged with opacity, layerSelect). */
  additionalFields?: RegistryFieldsType;
  /** Optional pre-built uiSchema (e.g. from processBaseSchema). When provided, merged with additionalProperties hidden field. */
  uiSchema?: UiSchema;
  /** Optional extra validation errors (RJSF extraErrors format). */
  extraErrors?: IDict;
  /** Optional ref to the hidden submit button; when provided, parent can trigger submit (e.g. on ok signal). */
  submitButtonRef?: React.MutableRefObject<HTMLButtonElement | null>;
  /** When provided, emit(true) when there are validation/extra errors, emit(false) when clear (e.g. to disable dialog OK). */
  formErrorSignal?: Signal<any, boolean>;
}

/** True if extraErrors has a non-empty __errors array. */
function hasExtraErrors(extraErrors: IDict | undefined): boolean {
  if (!extraErrors || typeof extraErrors !== 'object') {
    return false;
  }

  for (const key of Object.keys(extraErrors)) {
    const value = extraErrors[key];
    const errorList =
      value && typeof value === 'object'
        ? (value as IDict).__errors
        : undefined;

    if (Array.isArray(errorList) && errorList.length > 0) {
      return true;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (hasExtraErrors(value as IDict)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Renders a JSON Schema form (RJSF) for layer, source, and other object properties.
 * The parent is responsible for state (formData), syncing to the model, and dialog
 * behaviour; this component only renders the form and calls onChange/onSubmit.
 */
export function SchemaForm(props: ISchemaFormProps): React.ReactElement {
  const {
    schema,
    formData,
    onChange,
    onSubmit,
    formContext,
    filePath = '',
    liveValidate = true,
    additionalFields,
    uiSchema: uiSchemaProp,
    extraErrors,
    submitButtonRef,
    formErrorSignal,
  } = props;

  const schemaWithExtra: RJSFSchema = useMemo(
    () => ({ ...schema, additionalProperties: true }),
    [schema],
  );

  const defaultUiSchema = useMemo(
    () => ({
      additionalProperties: {
        'ui:label': false,
        classNames: 'jGIS-hidden-field',
      },
    }),
    [],
  );

  const uiSchema = useMemo(
    () =>
      uiSchemaProp ? { ...defaultUiSchema, ...uiSchemaProp } : defaultUiSchema,
    [uiSchemaProp, defaultUiSchema],
  );

  const fields = useMemo(
    () => ({ ...defaultFields, ...additionalFields }),
    [additionalFields],
  );

  const contextForForm: IJupyterGISFormContext = formContext;

  useEffect(() => {
    if (formErrorSignal) {
      formErrorSignal.emit(hasExtraErrors(extraErrors ?? undefined));
    }
  }, [formErrorSignal, extraErrors]);

  const handleChange = useCallback(
    (e: IChangeEvent) => {
      onChange((e.formData ?? {}) as IDict);
    },
    [onChange],
  );

  const handleSubmit = useCallback(
    (e: ISubmitEvent<any>) => {
      onSubmit((e.formData ?? {}) as IDict);
    },
    [onSubmit],
  );

  const handleKeyUp = useCallback(
    (
      e: React.KeyboardEvent,
      submitRef: React.RefObject<HTMLButtonElement | null>,
    ) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitRef.current?.click();
      }
    },
    [],
  );

  const submitRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="jGIS-property-panel" data-path={filePath}>
      <div
        className="jGIS-property-outer"
        onKeyUp={e => handleKeyUp(e, submitRef)}
      >
        <FormComponent
          schema={schemaWithExtra}
          uiSchema={uiSchema}
          formData={formData ?? {}}
          formContext={contextForForm}
          onChange={handleChange}
          onSubmit={handleSubmit}
          validator={validatorAjv8}
          fields={fields}
          liveValidate={liveValidate}
          extraErrors={extraErrors}
          children={
            <button
              ref={el => {
                (
                  submitRef as React.MutableRefObject<HTMLButtonElement | null>
                ).current = el;
                if (submitButtonRef) {
                  submitButtonRef.current = el;
                }
              }}
              type="submit"
              style={{ display: 'none' }}
            />
          }
          // FormComponent typings expect ReadonlyJSONObject and omit validator/fields; cast satisfies at runtime
          {...({} as any)}
        />
      </div>
    </div>
  );
}
