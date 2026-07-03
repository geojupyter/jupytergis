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

export function getSelectedDrawLayerId(
  model: IJupyterGISModel,
): string | undefined {
  const selected = model.selected;
  if (!selected) {
    return undefined;
  }

  return Object.keys(selected)[0];
}

export function useDrawDefaultAttributes(
  model: IJupyterGISModel,
  layerId: string | undefined,
  isActive = true,
) {
  const [attributes, setAttributes] = useState<IDrawDefaultAttribute[]>([]);
  const [draftMode, setDraftMode] = useState<DraftMode>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftKey, setDraftKey] = useState('');
  const [draftValue, setDraftValue] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);

  const refreshAttributes = useCallback(() => {
    if (!layerId) {
      setAttributes([]);
      return;
    }

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

  const resetDraft = (): void => {
    setDraftMode(null);
    setEditingIndex(null);
    setDraftKey('');
    setDraftValue('');
    setDraftError(null);
  };

  const persist = (next: IDrawDefaultAttribute[]): void => {
    if (!layerId) {
      return;
    }

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
    const existingKeys = attributes.map(attribute => attribute.key);
    const originalKey =
      draftMode === 'edit' && editingIndex !== null
        ? attributes[editingIndex]?.key
        : undefined;

    const keysForValidation = originalKey
      ? existingKeys.filter(key => key !== originalKey)
      : existingKeys;

    const validation = validateDrawAttributeKey(draftKey, keysForValidation);
    if (!validation.valid) {
      setDraftError(validation.error ?? 'Invalid key.');
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
    isDraftOpen: draftMode !== null,
    setDraftKey,
    setDraftValue,
    startAdd,
    startEdit,
    saveDraft,
    cancelDraft: resetDraft,
    removeAttribute,
    canAdd: draftMode === null && Boolean(layerId),
  };
}
