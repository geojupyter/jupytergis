import type {
  IDrawDefaultAttribute,
  IDrawDefaultAttributePresets,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { useCallback, useEffect, useState } from 'react';

import {
  normalizeDrawAttributeKey,
  validateDrawAttributeKey,
} from '../drawDefaultAttributes';

type DraftMode = 'add' | 'edit' | null;

export function useDrawDefaultAttributes(
  model: IJupyterGISModel,
  layerId: string,
) {
  const [attributes, setAttributes] = useState<IDrawDefaultAttribute[]>([]);
  const [presets, setPresets] = useState<IDrawDefaultAttributePresets>({});
  const [draftMode, setDraftMode] = useState<DraftMode>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftKey, setDraftKey] = useState('');
  const [draftValue, setDraftValue] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);

  const refreshAttributes = useCallback(() => {
    setAttributes(model.getDrawDefaultAttributes(layerId));
  }, [layerId, model]);

  const refreshPresets = useCallback(() => {
    setPresets(model.getDrawDefaultAttributePresets());
  }, [model]);

  useEffect(() => {
    refreshAttributes();
    refreshPresets();

    const onDrawDefaultAttributesChanged = (): void => {
      refreshAttributes();
    };

    const onPresetsChanged = (): void => {
      refreshPresets();
    };

    model.drawDefaultAttributesChanged.connect(onDrawDefaultAttributesChanged);
    model.sharedPresetsChanged.connect(onPresetsChanged);

    return () => {
      model.drawDefaultAttributesChanged.disconnect(
        onDrawDefaultAttributesChanged,
      );
      model.sharedPresetsChanged.disconnect(onPresetsChanged);
    };
  }, [model, refreshAttributes, refreshPresets]);

  const getKeysForValidation = useCallback((): string[] => {
    const existingKeys = attributes.map(attribute => attribute.key);
    const originalKey =
      draftMode === 'edit' && editingIndex !== null
        ? attributes[editingIndex]?.key
        : undefined;

    return originalKey
      ? existingKeys.filter(key => key !== originalKey)
      : existingKeys;
  }, [attributes, draftMode, editingIndex]);

  const getDraftKeyError = useCallback(
    (key: string, validateEmpty = false): string | null => {
      if (!key.trim() && !validateEmpty) {
        return null;
      }

      const validation = validateDrawAttributeKey(key, getKeysForValidation());
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

  const saveAttributes = (next: IDrawDefaultAttribute[]): void => {
    model.setDrawDefaultAttributesForLayer(layerId, next);
  };

  const startAdd = (): void => {
    setDraftMode('add');
    setEditingIndex(null);
    setDraftKey('');
    setDraftValue('');
    setDraftError(null);
  };

  const startEdit = (index: number): void => {
    const attribute = attributes[index];
    if (!attribute) {
      return;
    }

    setDraftMode('edit');
    setEditingIndex(index);
    setDraftKey(attribute.key);
    setDraftValue(attribute.value);
    setDraftError(null);
  };

  const saveDraft = (): void => {
    const entry = {
      key: normalizeDrawAttributeKey(draftKey),
      value: draftValue,
    };

    if (draftMode === 'add') {
      saveAttributes([...attributes, entry]);
    } else if (draftMode === 'edit' && editingIndex !== null) {
      saveAttributes(
        attributes.map((attribute, index) =>
          index === editingIndex ? entry : attribute,
        ),
      );
    }

    resetDraft();
  };

  const removeAttribute = (index: number): void => {
    if (editingIndex === index) {
      resetDraft();
    }

    saveAttributes(
      attributes.filter((_, attributeIndex) => attributeIndex !== index),
    );
  };

  const loadPreset = (name: string): void => {
    const presetAttributes = presets[name];
    if (!presetAttributes) {
      return;
    }

    resetDraft();
    saveAttributes(
      presetAttributes.map((attribute: IDrawDefaultAttribute) => ({
        ...attribute,
      })),
    );
  };

  const savePreset = (name: string): void => {
    model.setDrawDefaultAttributePreset(
      name.trim(),
      attributes.map(attribute => ({ ...attribute })),
    );
  };

  const presetNames = Object.keys(presets).sort((left, right) =>
    left.localeCompare(right),
  );

  return {
    attributes,
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
    removeAttribute,
    loadPreset,
    savePreset,
    canAdd: draftMode === null,
    canSavePreset: attributes.length > 0 && draftMode === null,
  };
}
