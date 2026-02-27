import { IDict, IGeoJSONSource, IHeatmapLayer } from '@jupytergis/schema';
import { UiSchema } from '@rjsf/utils';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { deepCopy, loadFile } from '@/src/tools';
import { SchemaForm } from '../SchemaForm';
import { processBaseSchema, removeFormEntry } from '../schemaUtils';
import { useSchemaFormState } from '../useSchemaFormState';
import type { ILayerProps } from './layerform';

async function fetchFeatureNames(
  model: ILayerProps['model'],
  layerData: IHeatmapLayer,
  sourceData?: IGeoJSONSource,
): Promise<string[]> {
  let resolvedSource = sourceData;

  if (layerData?.source && !resolvedSource) {
    const currentSource = model.getSource(layerData.source);
    if (!currentSource || currentSource.type !== 'GeoJSONSource') {
      return [];
    }
    resolvedSource = currentSource.parameters as IGeoJSONSource;
  }

  const source = model.getSource(layerData?.source);

  if (!source?.parameters?.path) {
    return [];
  }

  const jsonData = await loadFile({
    filepath: source.parameters.path,
    type: 'GeoJSONSource',
    model,
  });

  const featureProps = jsonData?.features?.[0]?.properties ?? {};

  return Object.keys(featureProps);
}

export function HeatmapLayerPropertiesForm(
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
    sourceFormChangedSignal,
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
  const [features, setFeatures] = useState<string[]>([]);
  const formDataRef = useRef<IDict>(formData);
  formDataRef.current = formData;

  useEffect(() => {
    let cancelled = false;
    fetchFeatureNames(model, formData as IHeatmapLayer)
      .then(names => {
        if (!cancelled) {
          setFeatures(names);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFeatures([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [model, formData?.source]);

  useEffect(() => {
    if (sourceType !== 'GeoJSONSource' || !sourceFormChangedSignal) {
      return;
    }

    const handler = (_sender: unknown, sourceDataPayload: IDict) => {
      fetchFeatureNames(
        model,
        formDataRef.current as IHeatmapLayer,
        sourceDataPayload as IGeoJSONSource,
      ).then(setFeatures);
    };

    sourceFormChangedSignal.connect(handler);

    return () => {
      sourceFormChangedSignal.disconnect(handler);
    };
  }, [sourceType, sourceFormChangedSignal, model]);

  const uiSchema = useMemo(() => {
    const builtUiSchema: UiSchema = {};
    const dataCopy = deepCopy(formData);

    removeFormEntry('color', dataCopy, schema, builtUiSchema);
    removeFormEntry('symbologyState', dataCopy, schema, builtUiSchema);
    removeFormEntry('blur', dataCopy, schema, builtUiSchema);
    removeFormEntry('radius', dataCopy, schema, builtUiSchema);
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

    builtUiSchema.feature = { enum: features };

    return builtUiSchema;
  }, [schema, formData, formContext, model, sourceType, features]);

  const handleSubmit = useCallback(
    (data: IDict) => {
      const submitted = { ...data, symbologyState: {} };
      handleSubmitBase(submitted);
    },
    [handleSubmitBase],
  );

  if (!hasSchema) {
    return null;
  }

  return (
    <SchemaForm
      schema={schema}
      formData={formData}
      onChange={handleChangeBase}
      onSubmit={handleSubmit}
      formContext={formContextValue}
      filePath={filePath}
      uiSchema={uiSchema}
    />
  );
}
