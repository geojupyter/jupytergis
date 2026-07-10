import type {
  IDrawCustomProperty,
  IDrawCustomPropertyPresets,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { useCallback, useEffect, useState } from 'react';

import {
  normalizeDrawCustomPropertyKey,
  validateDrawCustomPropertyKey,
} from '../drawCustomProperties';

type DraftMode = 'add' | 'edit' | null;

export function useDrawCustomProperties(
  model: IJupyterGISModel,
  layerId: string,
) {
  const [properties, setProperties] = useState<IDrawCustomProperty[]>([]);
  const [presets, setPresets] = useState<IDrawCustomPropertyPresets>({});
  const [draftMode, setDraftMode] = useState<DraftMode>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftKey, setDraftKey] = useState('');
  const [draftValue, setDraftValue] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);

  const refreshProperties = useCallback(() => {
    setProperties(model.getDrawCustomProperties(layerId));
  }, [layerId, model]);

  const refreshPresets = useCallback(() => {
    setPresets(model.getDrawCustomPropertyPresets());
  }, [model]);

  useEffect(() => {
    refreshProperties();
    refreshPresets();

    const onDrawCustomPropertiesChanged = (): void => {
      refreshProperties();
    };

    const onPresetsChanged = (): void => {
      refreshPresets();
    };

    model.drawCustomPropertiesChanged.connect(onDrawCustomPropertiesChanged);
    model.sharedPresetsChanged.connect(onPresetsChanged);

    return () => {
      model.drawCustomPropertiesChanged.disconnect(
        onDrawCustomPropertiesChanged,
      );
      model.sharedPresetsChanged.disconnect(onPresetsChanged);
    };
  }, [model, refreshProperties, refreshPresets]);

  const getKeysForValidation = useCallback((): string[] => {
    const existingKeys = properties.map(property => property.key);
    const originalKey =
      draftMode === 'edit' && editingIndex !== null
        ? properties[editingIndex]?.key
        : undefined;

    return originalKey
      ? existingKeys.filter(key => key !== originalKey)
      : existingKeys;
  }, [properties, draftMode, editingIndex]);

  const getDraftKeyError = useCallback(
    (key: string, validateEmpty = false): string | null => {
      if (!key.trim() && !validateEmpty) {
        return null;
      }

      const validation = validateDrawCustomPropertyKey(
        key,
        getKeysForValidation(),
      );
      return validation.valid ? null : (validation.error ?? 'Invalid key.');
    },
    [getKeysForValidation],
  );

  const handleDraftKeyChange = (value: string): void => {
    setDraftKey(value);
    setDraftError(getDraftKeyError(value));
  };

  const handleDraftValueChange = (value: string): void => {
    setDraftValue(value);
  };

  const resetDraft = (): void => {
    setDraftMode(null);
    setEditingIndex(null);
    setDraftKey('');
    setDraftValue('');
    setDraftError(null);
  };

  const saveProperties = (next: IDrawCustomProperty[]): void => {
    model.setDrawCustomPropertiesForLayer(layerId, next);
  };

  const startAdd = (): void => {
    setDraftMode('add');
    setEditingIndex(null);
    setDraftKey('');
    setDraftValue('');
    setDraftError(null);
  };

  const startEdit = (index: number): void => {
    const property = properties[index];
    if (!property) {
      return;
    }

    setDraftMode('edit');
    setEditingIndex(index);
    setDraftKey(property.key);
    setDraftValue(property.value);
    setDraftError(null);
  };

  const saveDraft = (): void => {
    const entry = {
      key: normalizeDrawCustomPropertyKey(draftKey),
      value: draftValue,
    };

    if (draftMode === 'add') {
      saveProperties([...properties, entry]);
    } else if (draftMode === 'edit' && editingIndex !== null) {
      saveProperties(
        properties.map((property, index) =>
          index === editingIndex ? entry : property,
        ),
      );
    }

    resetDraft();
  };

  const removeProperty = (index: number): void => {
    if (editingIndex === index) {
      resetDraft();
    }

    saveProperties(
      properties.filter((_, propertyIndex) => propertyIndex !== index),
    );
  };

  const loadPreset = (name: string): void => {
    const presetProperties = presets[name];
    if (!presetProperties) {
      return;
    }

    resetDraft();
    saveProperties(
      presetProperties.map((property: IDrawCustomProperty) => ({
        ...property,
      })),
    );
  };

  const savePreset = (name: string): void => {
    model.setDrawCustomPropertyPreset(
      name.trim(),
      properties.map(property => ({ ...property })),
    );
  };

  const presetNames = Object.keys(presets).sort((left, right) =>
    left.localeCompare(right),
  );

  return {
    properties,
    presets,
    presetNames,
    draftMode,
    editingIndex,
    draftKey,
    draftValue,
    draftError,
    setDraftKey: handleDraftKeyChange,
    setDraftValue: handleDraftValueChange,
    canSaveDraft: !getDraftKeyError(draftKey, true),
    startAdd,
    startEdit,
    saveDraft,
    cancelDraft: resetDraft,
    removeProperty,
    loadPreset,
    savePreset,
    canAdd: draftMode === null,
    canSavePreset: properties.length > 0 && draftMode === null,
  };
}
