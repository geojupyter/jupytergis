/**
 * Source form for OpenEOTileSource.
 *
 * The process graph and server URL are managed through the dedicated
 * process-graph editor rather than edited inline, so this form exposes an
 * "Edit Process Graph…" button and hides `serverUrl` from the schema.
 */
import { IDict } from '@jupytergis/schema';
import { UiSchema } from '@rjsf/utils';
import React, { useMemo } from 'react';

import {
  editOpenEOLayer,
  findOpenEOLayerIdForSource,
} from '@/src/features/layers/openeo';
import { SchemaForm } from '@/src/shared/formbuilder/objectform/SchemaForm';
import {
  processBaseSchema,
  removeFormEntry,
} from '@/src/shared/formbuilder/objectform/schemaUtils';
import { useSchemaFormState } from '@/src/shared/formbuilder/objectform/useSchemaFormState';
import { deepCopy } from '@/src/tools';
import type { ISourceFormProps } from './sourceform';

export function OpenEOSourcePropertiesForm(
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
    // serverUrl is resolved/managed through the process-graph editor, not
    // edited inline. Drop it from the form, schema and uiSchema.
    removeFormEntry('serverUrl', formData, schema, builtUiSchema);
    return builtUiSchema;
  }, [schema, formData, formContext]);

  const onEdit = async () => {
    const sourceId = props.sourceId;
    const layerId =
      sourceId !== undefined
        ? findOpenEOLayerIdForSource(model, sourceId)
        : undefined;
    if (!layerId) {
      return;
    }
    await editOpenEOLayer(model, layerId);
  };

  if (!hasSchema) {
    return null;
  }

  const hasEditableFields =
    schema.properties && Object.keys(schema.properties).length > 0;

  return (
    <div>
      {formContext === 'update' && (
        <button
          type="button"
          className="jp-mod-styled jp-mod-accept jp-openeo-edit-source-btn"
          onClick={onEdit}
          style={{ marginLeft: '15px', marginTop: '5px', marginBottom: '5px' }}
        >
          Edit Process Graph
        </button>
      )}
      {hasEditableFields && (
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
      )}
    </div>
  );
}
