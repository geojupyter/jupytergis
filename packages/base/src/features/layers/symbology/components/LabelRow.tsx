/**
 * The label editor: one row that stands in for the five grammar rules a label
 * is actually made of. See labelRules.ts for the translation.
 */

import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';

import RgbaColorPicker, {
  RgbaColor,
} from '@/src/features/layers/symbology/components/color_ramp/RgbaColorPicker';
import {
  FONT_FAMILIES,
  ILabelConfig,
} from '@/src/features/layers/symbology/labelRules';
import { Button } from '@/src/shared/components/Button';
import { InfoTip } from '@/src/shared/components/InfoTip';
import { Input } from '@/src/shared/components/Input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';

interface IFieldOption {
  value: string;
  label: string;
}

interface ILabelRowProps {
  config: ILabelConfig;
  availableFields: IFieldOption[];
  onChange: (config: ILabelConfig) => void;
  onDelete: () => void;
}

const LabelRow: React.FC<ILabelRowProps> = ({
  config,
  availableFields,
  onChange,
  onDelete,
}) => {
  const patch = (next: Partial<ILabelConfig>) =>
    onChange({ ...config, ...next });

  return (
    <div className="jp-gis-grammar-label-row">
      <span className="jp-gis-grammar-label-title">label</span>

      <label className="jp-gis-grammar-label-control">
        <span>text</span>
        <NativeSelect
          value={config.field ?? ''}
          onChange={e => patch({ field: e.target.value || undefined })}
        >
          <NativeSelectOption value="">(none)</NativeSelectOption>
          {availableFields.map(field => (
            <NativeSelectOption key={field.value} value={field.value}>
              {field.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>

      <label className="jp-gis-grammar-label-control">
        <span>font</span>
        <Input
          style={{ flex: '0 0 52px', minWidth: 0 }}
          type="number"
          min={1}
          value={String(config.fontSize)}
          onChange={e => {
            const size = Number(e.target.value);
            if (!isNaN(size) && size > 0) {
              patch({ fontSize: size });
            }
          }}
        />
        <NativeSelect
          value={config.fontFamily}
          onChange={e => patch({ fontFamily: e.target.value })}
        >
          {FONT_FAMILIES.map(family => (
            <NativeSelectOption key={family} value={family}>
              {family}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>

      <label className="jp-gis-grammar-label-control">
        <span>color</span>
        <RgbaColorPicker
          color={config.color as RgbaColor}
          onChange={color => patch({ color })}
        />
      </label>

      <label className="jp-gis-grammar-label-control">
        <input
          type="checkbox"
          checked={config.outline}
          onChange={e => patch({ outline: e.target.checked })}
        />
        <span>outline</span>
        <InfoTip text="A contrasting border drawn around each letter, so the label stays readable wherever it lands. Without it, dark text over a dark basemap disappears." />
      </label>

      {config.outline && (
        <>
          <RgbaColorPicker
            color={config.outlineColor as RgbaColor}
            onChange={outlineColor => patch({ outlineColor })}
          />
          <Input
            style={{ flex: '0 0 46px', minWidth: 0 }}
            type="number"
            min={1}
            title="Outline thickness in pixels"
            value={String(config.outlineWidth)}
            onChange={e => {
              const width = Number(e.target.value);
              if (!isNaN(width) && width > 0) {
                patch({ outlineWidth: width });
              }
            }}
          />
        </>
      )}

      <Button
        type="button"
        variant="icon"
        size="icon-md"
        className="jp-gis-grammar-label-delete"
        onClick={onDelete}
        title="Remove label"
      >
        <FontAwesomeIcon icon={faTrash} />
      </Button>
    </div>
  );
};

export default LabelRow;
