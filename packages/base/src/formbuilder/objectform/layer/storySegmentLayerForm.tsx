import { IDict } from '@jupytergis/schema';
import { RegistryFieldsType, UiSchema } from '@rjsf/utils';
import React, { useMemo } from 'react';

import { deepCopy } from '@/src/tools';
import { SchemaForm } from '../SchemaForm';
import type { ILayerProps } from './layerform';
import { ArrayFieldTemplate } from '../components/SegmentFormSymbology';
import StorySegmentReset from '../components/StorySegmentReset';
import { processBaseSchema, removeFormEntry } from '../schemaUtils';
import { useSchemaFormState } from '../useSchemaFormState';

function getFirstSelectedStorySegmentLayerId(
  model: ILayerProps['model'],
): string | undefined {
  const selected = model.selected;

  if (!selected) {
    return undefined;
  }

  for (const key of Object.keys(selected)) {
    const layer = model.getLayer(key);

    if (layer?.type === 'StorySegmentLayer') {
      return key;
    }
  }

  return undefined;
}

const StorySegmentResetField: RegistryFieldsType[string] = (props: any) => {
  const ctx = props.formContext as {
    model?: ILayerProps['model'];
    layerId?: string;
  };

  return <StorySegmentReset model={ctx?.model} layerId={ctx?.layerId} />;
};

export function StorySegmentLayerPropertiesForm(
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
  } = props;

  const {
    formData,
    schema,
    formContextValue: baseFormContext,
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

  const layerId = useMemo(
    () => getFirstSelectedStorySegmentLayerId(model),
    [model, model.selected],
  );

  const formContextValue = useMemo(
    () => ({ ...baseFormContext, layerId }),
    [baseFormContext, layerId],
  );

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

    if (schema.properties?.source) {
      const availableSources = model.getSourcesByType(sourceType);

      (schema.properties.source as IDict).enumNames =
        Object.values(availableSources);
      (schema.properties.source as IDict).enum = Object.keys(availableSources);
    }

    removeFormEntry('zoom', dataCopy, schema, builtUiSchema);

    const layerOverrideItems = schema.properties?.layerOverride as
      | IDict
      | undefined;
    const itemsProps = layerOverrideItems?.items as IDict | undefined;
    const itemsProperties = itemsProps?.properties as IDict | undefined;

    if (itemsProperties) {
      delete itemsProperties.color;
      delete itemsProperties.symbologyState;
    }

    if (model.selected) {
      builtUiSchema.extent = {
        'ui:field': 'storySegmentReset',
      };
    }

    builtUiSchema.content = {
      ...(builtUiSchema.content as IDict),
      markdown: {
        'ui:widget': 'textarea',
        'ui:options': {
          rows: 10,
        },
      },
    };

    builtUiSchema.layerOverride = {
      ...(builtUiSchema.layerOverride as IDict),
      items: {
        'ui:title': '',
        targetLayer: {
          'ui:field': 'layerSelect',
        },
        opacity: {
          'ui:field': 'opacity',
        },
      },
      'ui:options': {
        orderable: false,
      },
      'ui:ArrayFieldTemplate': ArrayFieldTemplate,
    };

    return builtUiSchema;
  }, [schema, formData, formContext, model, sourceType]);

  const additionalFields = useMemo<RegistryFieldsType>(
    () => ({
      storySegmentReset: StorySegmentResetField,
    }),
    [],
  );

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
      additionalFields={additionalFields}
    />
  );
}
