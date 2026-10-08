import type { IDict } from '@jupytergis/schema';
import { CirclePlus, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import {
  isReservedDrawCustomAttributeKey,
  normalizeDrawCustomAttributeKey,
  validateDrawCustomAttributeKey,
} from '@/src/features/labels/drawCustomAttributes';
import { Button } from '@/src/shared/components/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/shared/components/Dialog';
import { PropertyKeyValueFields } from '@/src/shared/components/PropertyKeyValueFields';

interface IAttributeRow {
  id: string;
  originalKey?: string;
  key: string;
  value: string;
}

interface IEditFeatureAttributesDialogProps {
  attributes: IDict<any>;
  onSave: (attributeUpdates: IDict<any>) => void;
  onClose: () => void;
}

function toRows(attributes: IDict<any>): IAttributeRow[] {
  return Object.entries(attributes)
    .filter(([key]) => !isReservedDrawCustomAttributeKey(key))
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value], index) => ({
      id: `${index}-${key}`,
      originalKey: key,
      key,
      value: value === null || value === undefined ? '' : String(value),
    }));
}

function collectUpdates(
  rows: IAttributeRow[],
  attributes: IDict<any>,
): IDict<any> {
  const updates: IDict<any> = {};
  const keptKeys = new Set<string>();

  rows.forEach(row => {
    const key = normalizeDrawCustomAttributeKey(row.key);
    if (!key) {
      return;
    }

    if (row.originalKey) {
      keptKeys.add(row.originalKey);
    }

    const renamed = row.originalKey !== undefined && row.originalKey !== key;
    const previousValue = row.originalKey
      ? attributes[row.originalKey]
      : undefined;

    if (renamed) {
      updates[row.originalKey as string] = undefined;
    }

    if (renamed || String(previousValue ?? '') !== row.value) {
      updates[key] = row.value;
    }
  });

  Object.keys(attributes)
    .filter(key => !isReservedDrawCustomAttributeKey(key))
    .forEach(key => {
      if (!keptKeys.has(key)) {
        updates[key] = undefined;
      }
    });

  return updates;
}

export function EditFeatureAttributesDialog({
  attributes,
  onSave,
  onClose,
}: IEditFeatureAttributesDialogProps): JSX.Element {
  const [rows, setRows] = useState<IAttributeRow[]>(() => toRows(attributes));
  const [nextRowId, setNextRowId] = useState(0);

  const error = useMemo(() => {
    for (const [index, row] of rows.entries()) {
      const others = rows
        .filter((_, otherIndex) => otherIndex !== index)
        .map(other => normalizeDrawCustomAttributeKey(other.key));

      const validation = validateDrawCustomAttributeKey(row.key, others);
      if (!validation.valid) {
        return validation.error ?? null;
      }
    }

    return null;
  }, [rows]);

  const updateRow = (id: string, patch: Partial<IAttributeRow>): void => {
    setRows(previous =>
      previous.map(row => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const addRow = (): void => {
    setRows(previous => [
      ...previous,
      { id: `new-${nextRowId}`, key: '', value: '' },
    ]);
    setNextRowId(previous => previous + 1);
  };

  const removeRow = (id: string): void => {
    setRows(previous => previous.filter(row => row.id !== id));
  };

  return (
    <Dialog open onOpenChange={open => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit feature</DialogTitle>
          <DialogDescription className="sr-only">
            Edit the attributes of the selected feature.
          </DialogDescription>
        </DialogHeader>

        <div className="jgis-draw-custom-attributes-dialog">
          <div className="jgis-attribute-rows jgis-draw-custom-attributes-list">
            {rows.length === 0 ? (
              <p className="jgis-draw-custom-attributes-empty">
                No attributes yet.
              </p>
            ) : null}
            {rows.map(row => (
              <div
                key={row.id}
                className="jgis-attribute-row jgis-attribute-row-editor"
              >
                <PropertyKeyValueFields
                  propertyKey={row.key}
                  propertyValue={row.value}
                  onPropertyKeyChange={key => updateRow(row.id, { key })}
                  onPropertyValueChange={value => updateRow(row.id, { value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Remove"
                  onClick={() => removeRow(row.id)}
                  className="text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>

          {error ? (
            <p className="jgis-draw-custom-attributes-error">{error}</p>
          ) : null}

          <Button
            className="jgis-attribute-add-button"
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
          >
            <CirclePlus data-icon="inline-start" />
            Add Attribute
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!!error}
            onClick={() => onSave(collectUpdates(rows, attributes))}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
