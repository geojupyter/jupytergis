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

import { DrawCustomPropertiesPresetsMenu } from '@/src/features/labels/components/DrawCustomPropertiesPresetsMenu';
import { validatePresetName } from '@/src/features/labels/drawCustomProperties';
import { useDrawCustomProperties } from '@/src/features/labels/hooks/useDrawCustomProperties';
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

interface IDrawCustomPropertyDraftRowProps {
  draftKey: string;
  draftValue: string;
  onDraftKeyChange: (value: string) => void;
  onDraftValueChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  canSave: boolean;
}

function DrawCustomPropertyDraftRow({
  draftKey,
  draftValue,
  onDraftKeyChange,
  onDraftValueChange,
  onSave,
  onCancel,
  canSave,
}: IDrawCustomPropertyDraftRowProps): JSX.Element {
  return (
    <div className="jgis-property-row jgis-property-row-editor">
      <PropertyKeyValueFields
        propertyKey={draftKey}
        propertyValue={draftValue}
        onPropertyKeyChange={onDraftKeyChange}
        onPropertyValueChange={onDraftValueChange}
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

interface IDrawCustomPropertiesDialogProps {
  model: IJupyterGISModel;
  drawLayerId: string;
}

export function DrawCustomPropertiesDialog({
  model,
  drawLayerId,
}: IDrawCustomPropertiesDialogProps): JSX.Element {
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
        <DrawCustomPropertiesDialogContent
          model={model}
          layerId={drawLayerId}
        />
      </DialogContent>
    </Dialog>
  );
}

interface IDrawCustomPropertiesDialogContentProps {
  model: IJupyterGISModel;
  layerId: string;
}

function DrawCustomPropertiesDialogContent({
  model,
  layerId,
}: IDrawCustomPropertiesDialogContentProps): JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null);
  const {
    properties,
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
    removeProperty,
    loadPreset,
    savePreset,
    canAdd,
    canSaveDraft,
    canSavePreset,
  } = useDrawCustomProperties(model, layerId);

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

  const handleSavePreset = (): void => {
    const trimmedName = presetName.trim();
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
      <DialogHeader className="jgis-draw-custom-properties-header">
        <DialogTitle className="jgis-draw-custom-properties-header-main">
          Set up custom properties
        </DialogTitle>
        <DialogDescription className="jgis-sr-only">
          Configure custom properties applied to newly drawn features.
        </DialogDescription>
      </DialogHeader>

      <div className="jgis-draw-custom-properties-dialog" ref={contentRef}>
        <div className="jgis-property-rows jgis-draw-custom-properties-list">
          {properties.length === 0 && draftMode === null ? (
            <p className="jgis-draw-custom-properties-empty">
              No custom properties yet.
            </p>
          ) : null}
          {properties.map((property, index) => {
            if (draftMode === 'edit' && editingIndex === index) {
              return (
                <DrawCustomPropertyDraftRow
                  key={`edit-${property.key}`}
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
                key={property.key}
                className="jgis-property-row jgis-draw-custom-properties-saved-row"
              >
                <span className="jgis-property-col-key">{property.key}</span>
                <span className="jgis-property-col-value">
                  {property.value}
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
                  onClick={() => removeProperty(index)}
                  disabled={controlsDisabled}
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}

          {draftMode === 'add' ? (
            <DrawCustomPropertyDraftRow
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
          <p className="jgis-draw-custom-properties-error">{draftError}</p>
        ) : null}

        {presetNameError ? (
          <p className="jgis-draw-custom-properties-error">{presetNameError}</p>
        ) : null}

        {savingPreset ? (
          <div className="jgis-property-row jgis-property-row-editor jgis-draw-custom-properties-preset-save-row">
            <Input
              className="jgis-draw-custom-properties-preset-name-input"
              type="text"
              placeholder="Preset name"
              value={presetName}
              onChange={event => handlePresetNameChange(event.target.value)}
            />
            <Button
              type="button"
              variant="icon"
              size="icon-md"
              title="Save preset"
              onClick={handleSavePreset}
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
        <div className="jgis-draw-custom-properties-row">
          <div className="jgis-draw-custom-properties-actions">
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
              Add Property
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
          <DrawCustomPropertiesPresetsMenu
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
