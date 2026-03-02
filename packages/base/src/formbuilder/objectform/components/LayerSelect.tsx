import { IJupyterGISModel, IStorySegmentLayer } from '@jupytergis/schema';
import { FieldProps } from '@rjsf/utils';
import React from 'react';

function extractlayerOverrideIndex(idSchema: {
  $id?: string;
}): number | undefined {
  const id = idSchema?.$id ?? '';
  const match = id.match(/layerOverride_(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

interface ILayerSelectFormContext {
  model?: IJupyterGISModel;
  formData?: IStorySegmentLayer;
}

/**
 * Simple select populated with layers (valid types only).
 * Used as the targetLayer field inside layerOverride array items.
 */
export function LayerSelect(props: FieldProps) {
  const { idSchema, formContext, formData, onChange } = props;
  const context = formContext as ILayerSelectFormContext | undefined;
  const model = context?.model;
  const fullFormData = context?.formData ?? (formData as IStorySegmentLayer);

  const arrayIndex = extractlayerOverrideIndex(idSchema ?? {});
  const value =
    arrayIndex !== undefined && fullFormData?.layerOverride?.[arrayIndex]
      ? (fullFormData.layerOverride[arrayIndex].targetLayer ?? '')
      : '';

  if (!model) {
    return null;
  }

  const layerOverride = fullFormData?.layerOverride ?? [];
  const currentTargetLayer =
    arrayIndex !== undefined
      ? fullFormData?.layerOverride?.[arrayIndex]?.targetLayer
      : undefined;

  const usedTargetLayerIds = new Set(
    layerOverride
      .filter((_: unknown, i: number) => i !== arrayIndex)
      .map(override => override.targetLayer)
      .filter(id => id !== undefined && id !== '')
      .filter(id => id !== currentTargetLayer),
  );

  const availableLayers = model.getLayers();
  const optionsList = Object.entries(availableLayers).filter(
    ([layerId, layer]) =>
      !usedTargetLayerIds.has(layerId) && layer.type !== 'StorySegmentLayer',
  );

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    onChange(newValue === '' ? undefined : newValue);
  };

  return (
    <select
      value={value ?? ''}
      onChange={handleChange}
      style={{ width: '100%' }}
    >
      <option value="">Select a layer</option>
      {optionsList.map(([layerId, layer]) => (
        <option key={layerId} value={layerId}>
          {layer.name.charAt(0).toUpperCase() + layer.name.slice(1)}
        </option>
      ))}
    </select>
  );
}
