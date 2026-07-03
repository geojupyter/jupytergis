import type {
  IDrawDefaultAttribute,
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
  isActive = true,
) {
  const [attributes, setAttributes] = useState<IDrawDefaultAttribute[]>([]);
  const [draftMode, setDraftMode] = useState<DraftMode>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftKey, setDraftKey] = useState('');
  const [draftValue, setDraftValue] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);

  const refreshAttributes = useCallback(() => {
    setAttributes(model.getDrawDefaultAttributes(layerId));
  }, [layerId, model]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    refreshAttributes();
  }, [isActive, refreshAttributes]);

  useEffect(() => {
    const onDrawDefaultAttributesChanged = (): void => {
      refreshAttributes();
    };

    model.drawDefaultAttributesChanged.connect(onDrawDefaultAttributesChanged);
    return () => {
      model.drawDefaultAttributesChanged.disconnect(
        onDrawDefaultAttributesChanged,
      );
    };
  }, [model, refreshAttributes]);

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

  const persist = (next: IDrawDefaultAttribute[]): void => {
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
    const error = getDraftKeyError(draftKey, true);
    if (error) {
      setDraftError(error);
      return;
    }

    const entry: IDrawDefaultAttribute = {
      key: normalizeDrawAttributeKey(draftKey),
      value: draftValue,
    };

    if (draftMode === 'add') {
      persist([...attributes, entry]);
    } else if (draftMode === 'edit' && editingIndex !== null) {
      persist(
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

    persist(attributes.filter((_, attributeIndex) => attributeIndex !== index));
  };

  return {
    attributes,
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
    canAdd: draftMode === null,
  };
}
