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

export interface IRasterizeFormProps extends IBaseFormProps {
  ok?: Signal<Dialog<any>, number>;
  model: IJupyterGISModel;
}

async function fetchNumericFieldNames(
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
  const jsonData =
    sourceData?.data ??
    (sourceData?.path
      ? await loadFile({
          filepath: sourceData.path,
          type: 'GeoJSONSource',
          model,
        })
      : undefined);
  if (!jsonData?.features?.length) {
    return [];
  }
  // gdal_rasterize -a needs a numeric attribute. Filter accordingly.
  const props = jsonData.features[0].properties ?? {};
  return Object.keys(props).filter(k => typeof props[k] === 'number');
}

export function RasterizeForm(
  props: IRasterizeFormProps,
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
    fetchNumericFieldNames(model, formData?.inputLayer)
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
      (schemaCopy.properties as IDict).attributeField
    ) {
      (schemaCopy.properties as IDict).attributeField = {
        ...(schemaCopy.properties.attributeField as IDict),
        enum: ['', ...features],
        enumNames: ['(use burn value)', ...features],
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
