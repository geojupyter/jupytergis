import type { IJupyterGISModel } from '@jupytergis/schema';
import {
  Ban,
  BookmarkPlus,
  CirclePlus,
  Pencil,
  Save,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import React, { useRef, useState } from 'react';

import { DrawCustomAttributesPresetsMenu } from '@/src/features/labels/components/DrawCustomAttributesPresetsMenu';
import { validatePresetName } from '@/src/features/labels/drawCustomAttributes';
import { useDrawCustomAttributes } from '@/src/features/labels/hooks/useDrawCustomAttributes';
import { ButtonTw } from '@/src/shared/components/ButtonTw';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/shared/components/Dialog';
import { Input } from '@/src/shared/components/Input';
import { PropertyKeyValueFields } from '@/src/shared/components/PropertyKeyValueFields';

interface IDrawCustomAttributeDraftRowProps {
  draftKey: string;
  draftValue: string;
  onDraftKeyChange: (value: string) => void;
  onDraftValueChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  canSave: boolean;
}

function DrawCustomAttributeDraftRow({
  draftKey,
  draftValue,
  onDraftKeyChange,
  onDraftValueChange,
  onSave,
  onCancel,
  canSave,
}: IDrawCustomAttributeDraftRowProps): JSX.Element {
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ): void => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    event.currentTarget.blur();
    if (canSave) {
      onSave();
    }
  };

  return (
    <div className="jgis-attribute-row jgis-attribute-row-editor">
      <PropertyKeyValueFields
        propertyKey={draftKey}
        propertyValue={draftValue}
        onPropertyKeyChange={onDraftKeyChange}
        onPropertyValueChange={onDraftValueChange}
        onKeyDown={handleKeyDown}
      />
      <div className="inline-flex gap-0">
        <ButtonTw
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Save"
          onClick={onSave}
          disabled={!canSave}
        >
          <Save />
        </ButtonTw>
        <ButtonTw
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Cancel"
          onClick={onCancel}
          className="text-destructive"
        >
          <Ban />
        </ButtonTw>
      </div>
    </div>
  );
}

interface IDrawCustomAttributesDialogProps {
  model: IJupyterGISModel;
  drawLayerId: string;
}

export function DrawCustomAttributesDialog({
  model,
  drawLayerId,
}: IDrawCustomAttributesDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <ButtonTw variant={'outline'}>
            <SlidersHorizontal data-icon="inline-start" />
            Edit
          </ButtonTw>
        }
      />
      <DialogContent>
        <DrawCustomAttributesDialogContent
          model={model}
          layerId={drawLayerId}
        />
      </DialogContent>
    </Dialog>
  );
}

interface IDrawCustomAttributesDialogContentProps {
  model: IJupyterGISModel;
  layerId: string;
}

function DrawCustomAttributesDialogContent({
  model,
  layerId,
}: IDrawCustomAttributesDialogContentProps): JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null);
  const {
    attributes,
    presets,
    presetNames,
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
    loadPreset,
    savePreset,
    canAdd,
    canSaveDraft,
    canSavePreset,
  } = useDrawCustomAttributes(model, layerId);

  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetNameError, setPresetNameError] = useState<string | null>(null);

  const controlsDisabled = draftMode !== null || savingPreset;
  const isPresetNameValid = validatePresetName(presetName).valid;

  const resetPresetDraft = (): void => {
    setSavingPreset(false);
    setPresetName('');
    setPresetNameError(null);
  };

  const handlePresetNameChange = (value: string): void => {
    setPresetName(value);
    const validation = validatePresetName(value);
    setPresetNameError(validation.valid ? null : (validation.error ?? null));
  };

  const handleSavePreset = (name: string = presetName): void => {
    const trimmedName = name.trim();
    if (!validatePresetName(trimmedName).valid) {
      return;
    }

    if (trimmedName in presets) {
      const confirmed = window.confirm(
        `Preset "${trimmedName}" already exists. Overwrite it?`,
      );

      if (!confirmed) {
        return;
      }
    }

    savePreset(trimmedName);
    resetPresetDraft();
  };

  return (
    <>
      <DialogHeader className="jgis-draw-custom-attributes-header">
        <DialogTitle className="jgis-draw-custom-attributes-header-main">
          Set up custom attributes
        </DialogTitle>
        <DialogDescription className="sr-only">
          Configure custom attributes applied to newly drawn features.
        </DialogDescription>
      </DialogHeader>

      <div className="jgis-draw-custom-attributes-dialog" ref={contentRef}>
        <div className="jgis-attribute-rows jgis-draw-custom-attributes-list">
          {attributes.length === 0 && draftMode === null ? (
            <p className="jgis-draw-custom-attributes-empty">
              No custom attributes yet.
            </p>
          ) : null}
          {attributes.map((attribute, index) => {
            if (draftMode === 'edit' && editingIndex === index) {
              return (
                <DrawCustomAttributeDraftRow
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
                className="jgis-attribute-row jgis-draw-custom-attributes-saved-row"
              >
                <span className="jgis-attribute-col-key">{attribute.key}</span>
                <span className="jgis-attribute-col-value">
                  {attribute.value}
                </span>
                <div className="inline-flex gap-0">
                  <ButtonTw
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Edit"
                    onClick={() => startEdit(index)}
                    disabled={controlsDisabled}
                  >
                    <Pencil />
                  </ButtonTw>
                  <ButtonTw
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Remove"
                    onClick={() => removeAttribute(index)}
                    disabled={controlsDisabled}
                    className="text-destructive"
                  >
                    <Trash2 />
                  </ButtonTw>
                </div>
              </div>
            );
          })}

          {draftMode === 'add' ? (
            <DrawCustomAttributeDraftRow
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
          <p className="jgis-draw-custom-attributes-error">{draftError}</p>
        ) : null}

        <div
          className={`jgis-draw-custom-attributes-preset-save-collapse${
            savingPreset
              ? ' jgis-draw-custom-attributes-preset-save-collapse--open'
              : ''
          }`}
        >
          {presetNameError ? (
            <p className="jgis-draw-custom-attributes-error">
              {presetNameError}
            </p>
          ) : null}

          <div className="jgis-attribute-row jgis-attribute-row-editor jgis-draw-custom-attributes-preset-save-row">
            <Input
              className="jgis-draw-custom-attributes-preset-name-input"
              type="text"
              placeholder="Preset name"
              value={presetName}
              onChange={event => handlePresetNameChange(event.target.value)}
              onKeyDown={event => {
                if (event.key !== 'Enter') {
                  return;
                }

                event.preventDefault();
                event.currentTarget.blur();
                if (validatePresetName(event.currentTarget.value).valid) {
                  handleSavePreset(event.currentTarget.value);
                }
              }}
            />
            <div className="inline-flex gap-0">
              <ButtonTw
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Save preset"
                onClick={() => handleSavePreset()}
                disabled={!isPresetNameValid}
              >
                <Save />
              </ButtonTw>
              <ButtonTw
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Cancel"
                className="text-destructive"
                onClick={resetPresetDraft}
              >
                <Ban />
              </ButtonTw>
            </div>
          </div>
        </div>
        <div className="jgis-draw-custom-attributes-row">
          <div className="jgis-draw-custom-attributes-actions">
            <ButtonTw
              className="jgis-attribute-add-button"
              type="button"
              variant="outline"
              onClick={startAdd}
              disabled={!canAdd}
            >
              <CirclePlus data-icon="inline-start" />
              Add Attribute
            </ButtonTw>
            <ButtonTw
              type="button"
              variant="outline"
              onClick={() => setSavingPreset(true)}
              disabled={!canSavePreset}
            >
              <BookmarkPlus data-icon="inline-start" />
              Save as preset
            </ButtonTw>
          </div>
          <DrawCustomAttributesPresetsMenu
            presets={presets}
            presetNames={presetNames}
            onLoadPreset={loadPreset}
            portalContainerRef={contentRef}
            disabled={controlsDisabled}
          />
        </div>
      </div>
    </>
  );
}
