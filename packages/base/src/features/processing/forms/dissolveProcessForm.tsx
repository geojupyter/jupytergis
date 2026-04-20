import { IDict, IGeoJSONSource, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { Signal } from '@lumino/signaling';
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { SchemaForm } from '@/src/formbuilder/objectform/SchemaForm';
import {
  processBaseSchema,
  removeFormEntry,
} from '@/src/formbuilder/objectform/schemaUtils';
import { useSchemaFormState } from '@/src/formbuilder/objectform/useSchemaFormState';
import { deepCopy, loadFile } from '@/src/tools';
import type { IBaseFormProps } from '@/src/types';

export interface IDissolveFormProps extends IBaseFormProps {
  ok?: Signal<Dialog<any>, number>;
  model: IJupyterGISModel;
}

async function fetchFieldNames(
  model: IJupyterGISModel,
  layerId: string | undefined,
): Promise<string[]> {
  if (!layerId) {
    return [];
  }
  const layer = model.getLayer(layerId);
  if (!layer?.parameters?.source) {
    return [];
  }
  const source = model.getSource(layer.parameters.source);
  if (!source || source.type !== 'GeoJSONSource') {
    return [];
  }
  const sourceData = source.parameters as IGeoJSONSource;
  if (!sourceData?.path) {
    return [];
  }
  const jsonData = await loadFile({
    filepath: sourceData.path,
    type: 'GeoJSONSource',
    model,
  });
  if (!jsonData?.features?.length) {
    return [];
  }
  return Object.keys(jsonData.features[0].properties ?? {});
}

export function DissolveForm(
  props: IDissolveFormProps,
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
    formContextValue,
    hasSchema,
    handleSubmitBase,
  } = useSchemaFormState({ sourceData, schemaProp, model, syncData });
  const [features, setFeatures] = useState<string[]>([]);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetchFieldNames(model, formData?.inputLayer)
      .then(setFeatures)
      .catch(() => setFeatures([]));
  }, [model, formData?.inputLayer]);

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

  const schema = useMemo(() => {
    const schemaCopy = deepCopy(schemaProp ?? {}) as RJSFSchema;

    if (
      schemaCopy.properties &&
      (schemaCopy.properties as IDict).dissolveField
    ) {
      (schemaCopy.properties as IDict).dissolveField = {
        ...(schemaCopy.properties.dissolveField as IDict),
        enum: [...features],
      };
    }

    return schemaCopy;
  }, [schemaProp, features]);

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
