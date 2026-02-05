import { IJupyterGISModel, IStorySegmentLayer } from '@jupytergis/schema';
import { FieldProps } from '@rjsf/utils';
import React from 'react';

import { SYMBOLOGY_VALID_LAYER_TYPES } from '@/src/types';

function extractSymbologyOverrideIndex(idSchema: {
  $id?: string;
}): number | undefined {
  const id = idSchema?.$id ?? '';
  const match = id.match(/symbologyOverride_(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

interface ILayerSelectFormContext {
  model?: IJupyterGISModel;
  formData?: IStorySegmentLayer;
}

/**
 * Simple select populated with layers (valid types only).
 * Used as the targetLayer field inside symbologyOverride array items.
 */
export function LayerSelect(props: FieldProps) {
  const { idSchema, formContext, formData, onChange } = props;
  const context = formContext as ILayerSelectFormContext | undefined;
  const model = context?.model;
  const fullFormData = context?.formData ?? (formData as IStorySegmentLayer);

  const arrayIndex = extractSymbologyOverrideIndex(idSchema ?? {});
  const value =
    arrayIndex !== undefined && fullFormData?.symbologyOverride?.[arrayIndex]
      ? (fullFormData.symbologyOverride[arrayIndex].targetLayer ?? '')
      : '';

  if (!model) {
    return null;
  }

  const symbologyOverride = fullFormData?.symbologyOverride ?? [];
  const currentTargetLayer =
    arrayIndex !== undefined
      ? fullFormData?.symbologyOverride?.[arrayIndex]?.targetLayer
      : undefined;

  const usedTargetLayerIds = new Set(
    symbologyOverride
      .filter((_: unknown, i: number) => i !== arrayIndex)
      .map(override => override.targetLayer)
      .filter(id => id !== undefined && id !== '')
      .filter(id => id !== currentTargetLayer),
  );

  const availableLayers = model.getLayers();
  const optionsList = Object.entries(availableLayers).filter(
    ([layerId, layer]) =>
      SYMBOLOGY_VALID_LAYER_TYPES.includes(layer.type) &&
      !usedTargetLayerIds.has(layerId),
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
