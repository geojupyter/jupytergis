import { IDict } from '@jupytergis/schema';
import { UiSchema } from '@rjsf/utils';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { deepCopy } from '@/src/tools';
import { SchemaForm } from '../SchemaForm';
import { processBaseSchema, removeFormEntry } from '../schemaUtils';
import { useSchemaFormState } from '../useSchemaFormState';
import type { ISourceFormProps } from './sourceform';
import { WmsTileSourceUrlInput } from '../components/WmsTileSourceUrlInput';
import { GlobalStateDbManager } from '@/src/store';

export function WmsTileSourceForm(
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

  const [wmsAvailableLayers, setWmsAvailableLayers] = useState<
    Array<{ name: string; title: string }>
  >([]);

  const stateDb = GlobalStateDbManager.getInstance().getStateDb();

  // Rehydrate available WMS layers from StateDB to avoid refetch on remount.
  useEffect(() => {
    const wmsUrl = formData?.url;

    if (!stateDb || !wmsUrl) {
      return;
    }

    const db = stateDb;
    const cacheKey = `jgis:wmsTileSource:availableLayers:${wmsUrl}`;

    async function loadLayersFromCache() {
      const cached = (await db.fetch(cacheKey)) as
        | Array<{ name: string; title: string }>
        | undefined;

      if (Array.isArray(cached) && cached.length > 0) {
        setWmsAvailableLayers(cached);
      } else {
        setWmsAvailableLayers([]);
        handleChangeBase({
          ...(formData ?? {}),
          params: {
            ...(((formData?.params ?? {}) as IDict) ?? {}),
            layers: undefined,
          },
        });
      }
    }

    void loadLayersFromCache();
  }, [stateDb, formData?.url]);

  useEffect(() => {
    console.log('formData', formData);
  }, [formData]);

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

    const layerNames = wmsAvailableLayers
      .map(layer => layer.name)
      .filter(name => typeof name === 'string' && name !== '');

    // Populate schema enum dynamically so RJSF renders a select for params.layers
    const params = (schema.properties?.params ?? {}) as IDict;
    const paramsProperties = (params.properties ?? {}) as IDict;
    if (paramsProperties.layers) {
      // Keep select options in sync with the cached/available layers list.
      // Avoid invalid schema (`enum` must be a non-empty array).
      if (layerNames.length > 0) {
        paramsProperties.layers.enum = layerNames;
      } else {
        delete (paramsProperties.layers as IDict).enum;
      }
    }

    builtUiSchema.url = {
      'ui:widget': WmsTileSourceUrlInput,
    };

    builtUiSchema.params = {
      ...(builtUiSchema.params as IDict),
      'ui:title': false,
      // 'ui:description': 'literal dog shit',
      layers: {
        ...(builtUiSchema.params as IDict)?.layers,
        'ui:widget': 'select',
        'ui:placeholder': 'Select a layer',
        'ui:enumNames': wmsAvailableLayers.map(layer => layer.title),
      },
    };

    return builtUiSchema;
  }, [schema, formData, formContext, wmsAvailableLayers]);

  if (!hasSchema) {
    return null;
  }

  return (
    <SchemaForm
      schema={schema}
      formData={formData}
      onChange={handleChangeBase}
      onSubmit={handleSubmitBase}
      formContext={{
        ...formContextValue,
        wmsAvailableLayers,
        setWmsAvailableLayers,
      }}
      filePath={filePath}
      uiSchema={uiSchema}
      formErrorSignal={formErrorSignal}
    />
  );
}
