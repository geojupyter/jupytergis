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
import { Button } from '@/src/shared/components/Button';
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
  const handleEnter = (): void => {
    if (canSave) {
      onSave();
    }
  };

  return (
    <div className="jgis-property-row jgis-property-row-editor">
      <PropertyKeyValueFields
        propertyKey={draftKey}
        propertyValue={draftValue}
        onPropertyKeyChange={onDraftKeyChange}
        onPropertyValueChange={onDraftValueChange}
        onEnter={handleEnter}
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
      <DialogTrigger asChild>
        <Button>
          <SlidersHorizontal
            data-icon="inline-start"
            className="jgis-inline-icon"
          />
          Edit
        </Button>
      </DialogTrigger>
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
        <DialogDescription className="jgis-sr-only">
          Configure custom attributes applied to newly drawn features.
        </DialogDescription>
      </DialogHeader>

      <div className="jgis-draw-custom-attributes-dialog" ref={contentRef}>
        <div className="jgis-property-rows jgis-draw-custom-attributes-list">
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
                className="jgis-property-row jgis-draw-custom-attributes-saved-row"
              >
                <span className="jgis-property-col-key">{attribute.key}</span>
                <span className="jgis-property-col-value">
                  {attribute.value}
                </span>
                <Button
                  type="button"
                  variant="icon"
                  size="icon-md"
                  title="Edit"
                  onClick={() => startEdit(index)}
                  disabled={controlsDisabled}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="icon"
                  size="icon-md"
                  title="Remove"
                  onClick={() => removeAttribute(index)}
                  disabled={controlsDisabled}
                >
                  <Trash2 />
                </Button>
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

        {presetNameError ? (
          <p className="jgis-draw-custom-attributes-error">{presetNameError}</p>
        ) : null}

        {savingPreset ? (
          <div className="jgis-property-row jgis-property-row-editor jgis-draw-custom-attributes-preset-save-row">
            <Input
              className="jgis-draw-custom-attributes-preset-name-input"
              type="text"
              placeholder="Preset name"
              value={presetName}
              onChange={event => handlePresetNameChange(event.target.value)}
              onEnter={value => {
                if (validatePresetName(value).valid) {
                  handleSavePreset(value);
                }
              }}
            />
            <Button
              type="button"
              variant="icon"
              size="icon-md"
              title="Save preset"
              onClick={() => handleSavePreset()}
              disabled={!isPresetNameValid}
            >
              <Save />
            </Button>
            <Button
              type="button"
              variant="icon"
              size="icon-md"
              title="Cancel"
              onClick={resetPresetDraft}
            >
              <Ban />
            </Button>
          </div>
        ) : null}
        <div className="jgis-draw-custom-attributes-row">
          <div className="jgis-draw-custom-attributes-actions">
            <Button
              className="jgis-property-add-button"
              type="button"
              variant="outline"
              size="sm"
              onClick={startAdd}
              disabled={!canAdd}
            >
              <CirclePlus
                data-icon="inline-start"
                className="jgis-inline-icon"
              />
              Add Attribute
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSavingPreset(true)}
              disabled={!canSavePreset}
            >
              <BookmarkPlus
                data-icon="inline-start"
                className="jgis-inline-icon"
              />
              Save as preset
            </Button>
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
