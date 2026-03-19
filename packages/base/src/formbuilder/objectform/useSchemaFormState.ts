/**
 * Shared state for schema-based forms: form data synced from sourceData,
 * copied schema, form context, and optional base change/submit handlers.
 * Forms use handleChangeBase/handleSubmitBase directly or wrap them for
 * validation and extra logic.
 */
import { IJupyterGISModel } from '@jupytergis/schema';
import { RJSFSchema } from '@rjsf/utils';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { deepCopy } from '@/src/tools';
import { IDict } from '@/src/types';

export interface IUseSchemaFormStateProps {
  /** External data to sync into the form (e.g. layer/source parameters). */
  sourceData: IDict | undefined;
  /** JSON Schema for the form (will be deep-copied). */
  schemaProp: IDict | undefined;
  /** Current JGIS model. */
  model: IJupyterGISModel;
  /** Called when form data changes (enables handleChangeBase). */
  syncData?: (data: IDict) => void;
  /** Called when form is submitted (enables handleSubmitBase). */
  cancel?: () => void;
  /** Optional side effect after change (e.g. update dialogOptions.layerData). */
  onAfterChange?: (data: IDict) => void;
}

export interface IUseSchemaFormStateResult {
  /** Current form data (controlled state). */
  formData: IDict;
  /** Set form data (e.g. from onChange). */
  setFormData: Dispatch<SetStateAction<IDict>>;
  /** Schema to pass to SchemaForm (deep copy of schemaProp). */
  schema: RJSFSchema;
  /** Form context value for SchemaForm (available to custom fields/widgets). */
  formContextValue: {
    model: IJupyterGISModel;
    formData: IDict;
    updateFormData: (data: IDict) => void;
  };
  /** Whether the form has a schema (false => form may render null). */
  hasSchema: boolean;
  /** Base change handler: setFormData, syncData, onAfterChange. Use or wrap. */
  handleChangeBase: (data: IDict) => void;
  /** Base submit handler: syncData(data), cancel?.(). Use or wrap. */
  handleSubmitBase: (data: IDict) => void;
}

/**
 * Manages form data state, schema copy, and form context for object forms.
 * Callers supply uiSchema, handleChange, handleSubmit, and any validation.
 */
export function useSchemaFormState(
  props: IUseSchemaFormStateProps,
): IUseSchemaFormStateResult {
  const { sourceData, schemaProp, model, syncData, cancel, onAfterChange } =
    props;

  const [formData, setFormData] = useState<IDict>(() =>
    deepCopy(sourceData ?? {}),
  );

  useEffect(() => {
    if (sourceData !== undefined) {
      setFormData(deepCopy(sourceData ?? {}));
    }
  }, [sourceData]);

  const schema = useMemo(
    () => deepCopy(schemaProp ?? {}) as RJSFSchema,
    [schemaProp],
  );

  const handleChangeBase = useCallback(
    (data: IDict) => {
      setFormData(data);
      syncData?.(data);
      onAfterChange?.(data);
    },
    [syncData, onAfterChange],
  );

  const formContextValue = useMemo(
    () => ({ model, formData, updateFormData: handleChangeBase }),
    [model, formData, handleChangeBase],
  );

  const handleSubmitBase = useCallback(
    (data: IDict) => {
      syncData?.(data);
      cancel?.();
    },
    [syncData, cancel],
  );

  return {
    formData,
    setFormData,
    schema,
    formContextValue,
    hasSchema: schemaProp !== null,
    handleChangeBase,
    handleSubmitBase,
  };
}
