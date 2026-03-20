import { IDict } from '@jupytergis/schema';
import { UiSchema } from '@rjsf/utils';
import React, { ReactElement, useEffect, useMemo, useState } from 'react';

import { SchemaForm } from '@/src/formbuilder/objectform/SchemaForm';
import { WmsTileSourceUrlInput } from '@/src/formbuilder/objectform/components/WmsTileSourceUrlInput';
import {
  processBaseSchema,
  removeFormEntry,
} from '@/src/formbuilder/objectform/schemaUtils';
import type { ISourceFormProps } from '@/src/formbuilder/objectform/source/sourceform';
import { useSchemaFormState } from '@/src/formbuilder/objectform/useSchemaFormState';
import { GlobalStateDbManager } from '@/src/store';
import { deepCopy } from '@/src/tools';
import { IWmsLayerInfo } from '@/src/types';

export const WMS_AVAILABLE_LAYERS_CACHE = 'jgis:wmsTileSource:availableLayers';

export function WmsTileSourceForm(
  props: ISourceFormProps,
): ReactElement | null {
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

  const [wmsAvailableLayers, setWmsAvailableLayers] = useState<IWmsLayerInfo[]>(
    [],
  );

  const stateDb = GlobalStateDbManager.getInstance().getStateDb();

  // Rehydrate available WMS layers from StateDB to avoid having to refetch on remount.
  useEffect(() => {
    const wmsUrl = formData?.url;

    if (!stateDb || !wmsUrl) {
      return;
    }

    const db = stateDb;
    const cacheKey = `${WMS_AVAILABLE_LAYERS_CACHE}:${wmsUrl}`;

    async function loadLayersFromCache() {
      const cached = (await db.fetch(cacheKey)) as IWmsLayerInfo[] | undefined;

      if (cached && cached.length > 0) {
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
      .filter(name => name !== '');

    // Populate schema enum dynamically so RJSF renders a select for params.layers
    const params = (schema.properties?.params ?? {}) as IDict;
    const paramsProperties = (params.properties ?? {}) as IDict;
    if (paramsProperties.layers) {
      // Keep select options in sync with the cached/available layers list.
      if (layerNames.length > 0) {
        paramsProperties.layers.enum = layerNames;
      } else {
        // Avoid invalid schema (`enum` must be a non-empty array).
        delete (paramsProperties.layers as IDict).enum;
      }
    }

    builtUiSchema.url = {
      'ui:widget': WmsTileSourceUrlInput,
    };

    builtUiSchema.params = {
      ...(builtUiSchema.params as IDict),
      'ui:title': false,
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
