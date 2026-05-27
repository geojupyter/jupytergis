import { IDict } from '@jupytergis/schema';
import { RegistryFieldsType, UiSchema } from '@rjsf/utils';
import React, { useCallback, useMemo } from 'react';

import { SchemaForm } from '@/src/shared/formbuilder/objectform/SchemaForm';
import { ArrayFieldTemplate } from '@/src/shared/formbuilder/objectform/components/SegmentFormSymbology';
import { SourcePropertiesField } from '@/src/shared/formbuilder/objectform/components/SourcePropertiesField';
import StorySegmentReset from '@/src/shared/formbuilder/objectform/components/StorySegmentReset';
import {
  processBaseSchema,
  removeFormEntry,
  removeNestedFormEntry,
} from '@/src/shared/formbuilder/objectform/schemaUtils';
import { useSchemaFormState } from '@/src/shared/formbuilder/objectform/useSchemaFormState';
import { deepCopy } from '@/src/tools';
import type { ILayerProps } from './layerform';

function normalizeSegmentContent(content: IDict | undefined): IDict {
  const value = content ?? {};

  if (value.contentMode === 'markdown') {
    return {
      contentMode: 'markdown',
      markdown: value.markdown ?? '',
    };
  }

  return {
    contentMode: 'map',
    title: value.title ?? '',
    image: value.image ?? '',
    markdown: value.markdown ?? '',
  };
}

function normalizeStorySegmentFormData(data: IDict): IDict {
  const normalizedData = deepCopy(data);
  normalizedData.content = normalizeSegmentContent(normalizedData.content);
  return normalizedData;
}

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
    formErrorSignal,
    formSchemaRegistry,
  } = props;

  const {
    formData,
    schema,
    formContextValue: baseFormContext,
    hasSchema,
    handleChangeBase,
    handleSubmitBase,
  } = useSchemaFormState({
    sourceData: sourceData
      ? normalizeStorySegmentFormData(sourceData)
      : undefined,
    schemaProp,
    model,
    syncData,
    cancel: props.cancel,
    onAfterChange: dialogOptions
      ? (data: IDict) => {
          dialogOptions.layerData = { ...normalizeStorySegmentFormData(data) };
        }
      : undefined,
  });

  const handleChange = useCallback(
    (data: IDict) => {
      handleChangeBase(normalizeStorySegmentFormData(data));
    },
    [handleChangeBase],
  );

  const handleSubmit = useCallback(
    (data: IDict) => {
      handleSubmitBase(normalizeStorySegmentFormData(data));
    },
    [handleSubmitBase],
  );

  const displayFormData = useMemo(
    () => normalizeStorySegmentFormData(formData),
    [formData],
  );

  const contentMode =
    displayFormData.content.contentMode === 'markdown' ? 'markdown' : 'map';

  const layerId = useMemo(
    () => getFirstSelectedStorySegmentLayerId(model),
    [model, model.selected],
  );

  const formContextValue = useMemo(
    () => ({ ...baseFormContext, layerId, formSchemaRegistry }),
    [baseFormContext, layerId],
  );

  const { displaySchema, uiSchema } = useMemo(() => {
    const displaySchema = deepCopy(schema);
    const builtUiSchema: UiSchema = {};
    const dataCopy = deepCopy(displayFormData);

    processBaseSchema(
      dataCopy,
      displaySchema,
      builtUiSchema,
      formContext,
      removeFormEntry,
    );

    if (displaySchema.properties?.source) {
      const availableSources = model.getSourcesByType(sourceType);

      (displaySchema.properties.source as IDict).enumNames =
        Object.values(availableSources);
      (displaySchema.properties.source as IDict).enum =
        Object.keys(availableSources);
    }

    removeFormEntry('zoom', dataCopy, displaySchema, builtUiSchema);

    const layerOverrideItems = displaySchema.properties?.layerOverride as
      | IDict
      | undefined;
    const itemsProps = layerOverrideItems?.items;
    const itemsProperties = itemsProps?.properties;

    if (itemsProperties) {
      delete itemsProperties.color;
      delete itemsProperties.symbologyState;
    }

    const contentFieldUi = {
      ...(builtUiSchema.content as IDict),
      contentMode: {
        'ui:widget': 'select',
      },
      markdown: {
        'ui:widget': 'textarea',
        'ui:options': {
          rows: 10,
        },
      },
    };

    if (contentMode === 'markdown') {
      removeNestedFormEntry(
        'content',
        'title',
        dataCopy,
        displaySchema,
        builtUiSchema,
      );
      removeNestedFormEntry(
        'content',
        'image',
        dataCopy,
        displaySchema,
        builtUiSchema,
      );
      removeFormEntry('transition', dataCopy, displaySchema, builtUiSchema);
      removeFormEntry('layerOverride', dataCopy, displaySchema, builtUiSchema);
      removeFormEntry('extent', dataCopy, displaySchema, builtUiSchema);

      builtUiSchema.content = {
        ...contentFieldUi,
        'ui:order': ['contentMode', 'markdown'],
      };
    } else {
      // contentMode === 'map'
      builtUiSchema.content = {
        ...contentFieldUi,
        'ui:order': ['contentMode', 'title', 'image', 'markdown'],
      };

      if (model.selected) {
        builtUiSchema.extent = {
          'ui:field': 'storySegmentReset',
        };
      }

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
          sourceProperties: {
            'ui:field': SourcePropertiesField,
          },
        },
        'ui:options': {
          orderable: false,
        },
        'ui:ArrayFieldTemplate': ArrayFieldTemplate,
      };
    }

    return { displaySchema, uiSchema: builtUiSchema };
  }, [
    schema,
    displayFormData,
    formContext,
    model,
    sourceType,
    contentMode,
    model.selected,
  ]);

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
      schema={displaySchema}
      formData={displayFormData}
      onChange={handleChange}
      onSubmit={handleSubmit}
      formContext={formContextValue}
      filePath={filePath}
      uiSchema={uiSchema}
      additionalFields={additionalFields}
      formErrorSignal={formErrorSignal}
    />
  );
}
