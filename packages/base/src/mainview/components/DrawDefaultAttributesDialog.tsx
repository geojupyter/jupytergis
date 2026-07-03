import type { IJupyterGISModel } from '@jupytergis/schema';
import { Ban, CirclePlus, Pencil, Save, Trash2 } from 'lucide-react';
import React from 'react';

import { Button } from '@/src/shared/components/Button';
import { Input } from '@/src/shared/components/Input';
import { useDrawDefaultAttributes } from '../hooks/useDrawDefaultAttributes';

interface IDrawAttributeDraftRowProps {
  draftKey: string;
  draftValue: string;
  onDraftKeyChange: (value: string) => void;
  onDraftValueChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  canSave: boolean;
}

function DrawAttributeDraftRow({
  draftKey,
  draftValue,
  onDraftKeyChange,
  onDraftValueChange,
  onSave,
  onCancel,
  canSave,
}: IDrawAttributeDraftRowProps): JSX.Element {
  return (
    <div className="jgis-property-row jgis-property-row-editor">
      <Input
        className="jgis-property-col-key"
        type="text"
        placeholder="key"
        value={draftKey}
        onChange={event => onDraftKeyChange(event.target.value)}
      />
      <Input
        className="jgis-property-col-value"
        type="text"
        placeholder="value"
        value={draftValue}
        onChange={event => onDraftValueChange(event.target.value)}
      />
      <Button
        type="button"
        variant="icon"
        size="icon-md"
        title="Save"
        onClick={onSave}
        disabled={!canSave}
      >
        <Save />
      </Button>
      <Button
        type="button"
        variant="icon"
        size="icon-md"
        title="Cancel"
        onClick={onCancel}
      >
        <Ban />
      </Button>
    </div>
  );
}

interface IDrawDefaultAttributesDialogProps {
  model: IJupyterGISModel;
  layerId: string;
}

export function DrawDefaultAttributesDialog({
  model,
  layerId,
}: IDrawDefaultAttributesDialogProps): JSX.Element {
  const {
    attributes,
    draftMode,
    editingIndex,
    draftKey,
    draftValue,
    draftError,
    setDraftKey,
    setDraftValue,
    startAdd,
    startEdit,
    saveDraft,
    cancelDraft,
    removeAttribute,
    canAdd,
    canSaveDraft,
  } = useDrawDefaultAttributes(model, layerId, true);

  return (
    <div className="jgis-draw-default-attributes-dialog">
      <div className="jgis-property-rows jgis-draw-default-attributes-list">
        {attributes.length === 0 && draftMode === null ? (
          <p className="jgis-draw-default-attributes-empty">
            No custom attributes yet. New features will use the default label.
          </p>
        ) : null}
        {attributes.map((attribute, index) => {
          if (draftMode === 'edit' && editingIndex === index) {
            return (
              <DrawAttributeDraftRow
                key={`edit-${attribute.key}`}
                draftKey={draftKey}
                draftValue={draftValue}
                onDraftKeyChange={setDraftKey}
                onDraftValueChange={setDraftValue}
                onSave={saveDraft}
                onCancel={cancelDraft}
                canSave={canSaveDraft}
              />
            );
          }

          return (
            <div
              key={attribute.key}
              className="jgis-property-row jgis-draw-default-attributes-saved-row"
            >
              <span className="jgis-property-col-key">{attribute.key}</span>
              <span className="jgis-property-col-value">{attribute.value}</span>
              <Button
                type="button"
                variant="icon"
                size="icon-md"
                title="Edit"
                onClick={() => startEdit(index)}
                disabled={draftMode !== null}
              >
                <Pencil />
              </Button>
              <Button
                type="button"
                variant="icon"
                size="icon-md"
                title="Remove"
                onClick={() => removeAttribute(index)}
                disabled={draftMode !== null}
              >
                <Trash2 />
              </Button>
            </div>
          );
        })}
        {draftMode === 'add' ? (
          <DrawAttributeDraftRow
            draftKey={draftKey}
            draftValue={draftValue}
            onDraftKeyChange={setDraftKey}
            onDraftValueChange={setDraftValue}
            onSave={saveDraft}
            onCancel={cancelDraft}
            canSave={canSaveDraft}
          />
        ) : null}
      </div>
      {draftError ? (
        <p className="jgis-draw-default-attributes-error">{draftError}</p>
      ) : null}
      <div className="jgis-property-row jgis-property-row-add">
        <Button
          className="jgis-property-add-button"
          type="button"
          variant="outline"
          size="sm"
          onClick={startAdd}
          disabled={!canAdd}
        >
          <CirclePlus data-icon="inline-start" className="jgis-inline-icon" />
          Add Property
        </Button>
      </div>
    </div>
  );
}
