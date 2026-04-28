import {
  IDict,
  IIdentifiedFeature,
  IIdentifiedFeatureEntry,
  IJupyterGISModel,
} from '@jupytergis/schema';
import React, { useState } from 'react';

import {
  IPropertyEditorActions,
  IPropertyEditorState,
} from '../types/editorTypes';

export function useIdentifyPropertyEditor(args: {
  model: IJupyterGISModel;
  patchGeoJSONFeatureProperties?: (
    sourceId: string,
    target: { featureId: string | number },
    propertyUpdates: IDict<any>,
  ) => Promise<boolean>;
  // ! weird type
  setFeatures: React.Dispatch<React.SetStateAction<IIdentifiedFeatureEntry[]>>;
}): {
  editorState: IPropertyEditorState;
  editorActions: IPropertyEditorActions;
} {
  const { model, patchGeoJSONFeatureProperties, setFeatures } = args;

  const [editingFeatureIndex, setEditingFeatureIndex] = useState<number | null>(
    null,
  );
  const [editorMode, setEditorMode] = useState<'add' | 'edit' | null>(null);
  const [editingPropertyKey, setEditingPropertyKey] = useState<string | null>(
    null,
  );
  const [newPropertyKey, setNewPropertyKey] = useState('');
  const [newPropertyValue, setNewPropertyValue] = useState('');
  const [isSavingProperty, setIsSavingProperty] = useState(false);

  const resetAddPropertyEditor = () => {
    setEditingFeatureIndex(null);
    setEditorMode(null);
    setEditingPropertyKey(null);
    setNewPropertyKey('');
    setNewPropertyValue('');
    setIsSavingProperty(false);
  };

  const startAddProperty = (featureIndex: number) => {
    setEditingFeatureIndex(featureIndex);
    setEditorMode('add');
    setEditingPropertyKey(null);
    setNewPropertyKey('');
    setNewPropertyValue('');
  };

  const handleAddProperty = async (
    feature: IIdentifiedFeature,
    featureIndex: number,
  ) => {
    const featureId = feature._id;
    if (featureId === undefined) {
      return;
    }

    const key = newPropertyKey.trim();
    const previousKey =
      editorMode === 'edit' ? editingPropertyKey?.trim() : undefined;
    if (!patchGeoJSONFeatureProperties || !key || isSavingProperty) {
      return;
    }

    const selectedLayers = model.localState?.selected?.value;
    if (!selectedLayers) {
      return;
    }

    const selectedLayerId = Object.keys(selectedLayers)[0];
    const selectedLayer = model.getLayer(selectedLayerId);
    const sourceId = selectedLayer?.parameters?.source;
    if (!sourceId) {
      return;
    }

    setIsSavingProperty(true);
    const propertyUpdates: IDict<any> = { [key]: newPropertyValue };
    if (previousKey && previousKey !== key) {
      propertyUpdates[previousKey] = undefined;
    }

    const success = await patchGeoJSONFeatureProperties(
      sourceId,
      { featureId },
      propertyUpdates,
    );

    if (success) {
      setFeatures(previous => {
        const updatedFeatures = [...previous];
        const targetFeatureEntry = updatedFeatures[featureIndex];

        if (targetFeatureEntry?.feature) {
          const updatedTargetFeature: IDict<any> = {
            ...targetFeatureEntry.feature,
          };
          if (previousKey && previousKey !== key) {
            delete updatedTargetFeature[previousKey];
          }
          updatedTargetFeature[key] = newPropertyValue;
          updatedFeatures[featureIndex] = {
            ...targetFeatureEntry,
            feature: updatedTargetFeature,
          };
        }

        model.syncIdentifiedFeatures(
          updatedFeatures,
          model.getClientId().toString(),
        );

        return updatedFeatures;
      });
      resetAddPropertyEditor();
      return;
    }

    setIsSavingProperty(false);
  };

  const editorState: IPropertyEditorState = {
    editingFeatureIndex,
    editorMode,
    editingPropertyKey,
    newPropertyKey,
    newPropertyValue,
    isSavingProperty,
  };

  const editorActions: IPropertyEditorActions = {
    onEditProperty: (index, propertyKey, value) => {
      setEditingFeatureIndex(index);
      setEditorMode('edit');
      setEditingPropertyKey(propertyKey);
      setNewPropertyKey(propertyKey);
      setNewPropertyValue(String(value ?? ''));
    },
    onStartAddProperty: startAddProperty,
    onSaveProperty: handleAddProperty,
    onCancelProperty: resetAddPropertyEditor,
    onNewPropertyKeyChange: setNewPropertyKey,
    onNewPropertyValueChange: setNewPropertyValue,
  };

  return { editorState, editorActions };
}
