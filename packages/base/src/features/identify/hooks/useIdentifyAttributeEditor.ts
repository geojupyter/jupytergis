import {
  IDict,
  IIdentifiedFeature,
  IIdentifiedFeatureEntry,
  IJupyterGISModel,
} from '@jupytergis/schema';
import React, { useState } from 'react';

import {
  IAttributeEditorActions,
  IAttributeEditorState,
  PatchGeoJSONFeatureAttributes,
} from '../types/editorTypes';

export function useIdentifyAttributeEditor(props: {
  model: IJupyterGISModel;
  patchGeoJSONFeatureAttributes?: PatchGeoJSONFeatureAttributes;
  setFeatures: React.Dispatch<React.SetStateAction<IIdentifiedFeatureEntry[]>>;
}): {
  editorState: IAttributeEditorState;
  editorActions: IAttributeEditorActions;
} {
  const { model, patchGeoJSONFeatureAttributes, setFeatures } = props;

  const [editingFeatureIndex, setEditingFeatureIndex] = useState<number | null>(
    null,
  );
  const [editorMode, setEditorMode] = useState<'add' | 'edit' | null>(null);
  const [editingAttributeKey, setEditingAttributeKey] = useState<
    string | null
  >(null);
  const [newAttributeKey, setNewAttributeKey] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [isSavingAttribute, setIsSavingAttribute] = useState(false);

  const resetAddAttributeEditor = () => {
    setEditingFeatureIndex(null);
    setEditorMode(null);
    setEditingAttributeKey(null);
    setNewAttributeKey('');
    setNewAttributeValue('');
    setIsSavingAttribute(false);
  };

  const startAddAttribute = (featureIndex: number) => {
    setEditingFeatureIndex(featureIndex);
    setEditorMode('add');
    setEditingAttributeKey(null);
    setNewAttributeKey('');
    setNewAttributeValue('');
  };

  const getSelectedSourceId = (): string | undefined => {
    const selectedLayers = model.localState?.selected?.value;
    if (!selectedLayers) {
      return undefined;
    }
    const selectedLayerId = Object.keys(selectedLayers)[0];
    const selectedLayer = model.getLayer(selectedLayerId);
    return selectedLayer?.parameters?.source;
  };

  const handleAddAttribute = async (
    feature: IIdentifiedFeature,
    featureIndex: number,
  ) => {
    const featureId = feature._id;

    if (!featureId) {
      return;
    }

    const sourceId = getSelectedSourceId();
    const key = newAttributeKey.trim();
    const previousKey =
      editorMode === 'edit' ? editingAttributeKey?.trim() : undefined;

    if (
      !sourceId ||
      !patchGeoJSONFeatureAttributes ||
      !key ||
      isSavingAttribute
    ) {
      return;
    }

    setIsSavingAttribute(true);
    const attributeUpdates: IDict<any> = { [key]: newAttributeValue };

    if (previousKey && previousKey !== key) {
      attributeUpdates[previousKey] = undefined;
    }

    const success = await patchGeoJSONFeatureAttributes(
      sourceId,
      { featureId },
      attributeUpdates,
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

          updatedTargetFeature[key] = newAttributeValue;
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

      resetAddAttributeEditor();
      return;
    }

    setIsSavingAttribute(false);
  };

  const handleDeleteAttribute = async (
    feature: IIdentifiedFeature,
    featureIndex: number,
    attributeKey: string,
  ) => {
    const featureId = feature._id;

    if (!featureId) {
      return;
    }

    if (
      !patchGeoJSONFeatureAttributes ||
      !attributeKey.trim() ||
      isSavingAttribute
    ) {
      return;
    }

    const sourceId = getSelectedSourceId();
    if (!sourceId) {
      return;
    }

    setIsSavingAttribute(true);
    const success = await patchGeoJSONFeatureAttributes(
      sourceId,
      { featureId },
      { [attributeKey]: undefined },
    );

    if (success) {
      setFeatures(previous => {
        const updatedFeatures = [...previous];
        const targetFeatureEntry = updatedFeatures[featureIndex];

        if (targetFeatureEntry?.feature) {
          const updatedTargetFeature: IDict<any> = {
            ...targetFeatureEntry.feature,
          };

          delete updatedTargetFeature[attributeKey];

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

      resetAddAttributeEditor();
      return;
    }

    setIsSavingAttribute(false);
  };

  const editorState: IAttributeEditorState = {
    editingFeatureIndex,
    editorMode,
    editingAttributeKey,
    newAttributeKey,
    newAttributeValue,
    isSavingAttribute,
  };

  const editorActions: IAttributeEditorActions = {
    onEditAttribute: (index, attributeKey, value) => {
      setEditingFeatureIndex(index);
      setEditorMode('edit');
      setEditingAttributeKey(attributeKey);
      setNewAttributeKey(attributeKey);
      setNewAttributeValue(String(value ?? ''));
    },
    onDeleteAttribute: handleDeleteAttribute,
    onStartAddAttribute: startAddAttribute,
    onSaveAttribute: handleAddAttribute,
    onCancelAttribute: resetAddAttributeEditor,
    onNewAttributeKeyChange: setNewAttributeKey,
    onNewAttributeValueChange: setNewAttributeValue,
  };

  return { editorState, editorActions };
}
