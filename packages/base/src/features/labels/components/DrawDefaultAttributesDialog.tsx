import type { IJupyterGISModel } from '@jupytergis/schema';
import {
  Ban,
  BookmarkPlus,
  CirclePlus,
  Pencil,
  Save,
  Trash2,
} from 'lucide-react';
import React, { useRef, useState } from 'react';

import { validatePresetName } from '@/src/features/labels/drawDefaultAttributes';
import { DrawDefaultAttributesPresetsMenu } from '@/src/features/labels/components/DrawDefaultAttributesPresetsMenu';
import { useDrawDefaultAttributes } from '@/src/features/labels/hooks/useDrawDefaultAttributes';
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
  drawLayerId?: string;
}

export function DrawDefaultAttributesDialog({
  model,
  drawLayerId,
}: IDrawDefaultAttributesDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Dialog modal={false} open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!drawLayerId}>Edit</Button>
      </DialogTrigger>
      <DialogContent preventOutsideDismiss>
        {open && drawLayerId ? (
          <DrawDefaultAttributesDialogContent
            model={model}
            layerId={drawLayerId}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface IDrawDefaultAttributesDialogContentProps {
  model: IJupyterGISModel;
  layerId: string;
}

function DrawDefaultAttributesDialogContent({
  model,
  layerId,
}: IDrawDefaultAttributesDialogContentProps): JSX.Element {
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
  } = useDrawDefaultAttributes(model, layerId);

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
      <DialogHeader className="jgis-draw-default-attributes-header">
        <DialogTitle className="jgis-draw-default-attributes-header-main">
          Set up custom attributes
        </DialogTitle>
        <DialogDescription className="jgis-sr-only">
          Configure default attributes applied to newly drawn features.
        </DialogDescription>
      </DialogHeader>

      <div className="jgis-draw-default-attributes-dialog" ref={contentRef}>
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

        {presetNameError ? (
          <p className="jgis-draw-default-attributes-error">
            {presetNameError}
          </p>
        ) : null}

        {savingPreset ? (
          <div className="jgis-property-row jgis-property-row-editor jgis-draw-default-attributes-preset-save-row">
            <Input
              className="jgis-draw-default-attributes-preset-name-input"
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
        <div className="jgis-draw-default-attributes-row">
          <div className="jgis-draw-default-attributes-actions">
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
          <DrawDefaultAttributesPresetsMenu
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
