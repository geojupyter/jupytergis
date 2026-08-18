import React, { useEffect, useState } from 'react';

import {
  CSS_WIDTH_UNITS,
  parseCssWidth,
  resolveCssWidth,
  validateCssWidth,
} from '@/src/features/story/utils/cssWidth';
import { Button, type ButtonProps } from '@/src/shared/components/Button';
import { ButtonGroup } from '@/src/shared/components/ButtonGroup';
import { Input } from '@/src/shared/components/Input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';

const CSS_AMOUNT_FRAGMENT = /^\d*\.?\d*$/;
const CSS_AMOUNT_COMPLETE = /^\d*\.?\d+$/;

function sanitizeCssAmountInput(raw: string): string {
  if (CSS_AMOUNT_FRAGMENT.test(raw)) {
    return raw;
  }

  let result = '';
  let hasDot = false;
  for (const char of raw) {
    if (char >= '0' && char <= '9') {
      result += char;
    } else if (char === '.' && !hasDot) {
      result += '.';
      hasDot = true;
    }
  }
  return result;
}

export interface ICssWidthPreset {
  id: string;
  label: string;
  value: string;
}

export interface ICssWidthPickerProps {
  label: string;
  value: string | undefined;
  onChange: (width: string) => void;
  presets: readonly ICssWidthPreset[];
  presetGroupAriaLabel: string;
  layout?: 'field' | 'block';
  size?: ButtonProps['size'];
}

export function CssWidthPicker({
  label,
  value,
  onChange,
  presets,
  presetGroupAriaLabel,
  layout = 'field',
  size,
}: ICssWidthPickerProps): JSX.Element {
  const resolved = resolveCssWidth(value);
  const matchedPreset = presets.find(preset => preset.value === resolved);
  const parsed = parseCssWidth(resolved) ?? { amount: '', unit: '%' };
  const [isCustom, setIsCustom] = useState(() => matchedPreset === undefined);
  const [amount, setAmount] = useState(parsed.amount);
  const [unit, setUnit] = useState(parsed.unit);
  const [widthError, setWidthError] = useState<string | null>(null);
  const selectedPresetId = isCustom ? null : matchedPreset?.id;

  useEffect(() => {
    const nextResolved = resolveCssWidth(value);
    const nextPreset = presets.find(preset => preset.value === nextResolved);
    const nextParsed = parseCssWidth(nextResolved) ?? {
      amount: '',
      unit: '%',
    };
    setIsCustom(nextPreset === undefined);
    setAmount(nextParsed.amount);
    setUnit(nextParsed.unit);
    setWidthError(null);
  }, [value, presets]);

  const commitCustomWidth = (nextAmount: string, nextUnit: string): void => {
    if (!CSS_AMOUNT_COMPLETE.test(nextAmount.trim())) {
      setWidthError('Enter a valid width');
      return;
    }

    const validationError = validateCssWidth(nextAmount, nextUnit);
    if (validationError) {
      setWidthError(validationError);
      return;
    }

    setWidthError(null);
    onChange(`${nextAmount.trim()}${nextUnit}`);
  };

  const presetButtons = (
    <ButtonGroup aria-label={presetGroupAriaLabel}>
      {presets.map(preset => (
        <Button
          key={preset.id}
          type="button"
          size={size}
          variant={selectedPresetId === preset.id ? 'secondary' : 'outline'}
          aria-pressed={selectedPresetId === preset.id}
          title={preset.value}
          onClick={() => {
            setIsCustom(false);
            onChange(preset.value);
          }}
        >
          {preset.label}
        </Button>
      ))}
      <Button
        type="button"
        size={size}
        variant={isCustom ? 'secondary' : 'outline'}
        aria-pressed={isCustom}
        onClick={() => {
          setIsCustom(true);
        }}
      >
        Custom
      </Button>
    </ButtonGroup>
  );

  const customEditor = isCustom ? (
    <>
      <div className="jgis-story-editor-width-custom">
        <Input
          aria-label={`${label} amount`}
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={event => {
            const nextAmount = sanitizeCssAmountInput(event.target.value);
            setAmount(nextAmount);
            commitCustomWidth(nextAmount, unit);
          }}
        />
        <NativeSelect
          aria-label={`${label} unit`}
          value={unit}
          onChange={event => {
            const nextUnit = event.target.value;
            setUnit(nextUnit as (typeof CSS_WIDTH_UNITS)[number]);
            commitCustomWidth(amount, nextUnit);
          }}
        >
          {CSS_WIDTH_UNITS.map(unitOption => (
            <NativeSelectOption key={unitOption} value={unitOption}>
              {unitOption}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {widthError ? (
        <p className="jgis-story-editor-field-error">{widthError}</p>
      ) : null}
    </>
  ) : null;

  if (layout === 'block') {
    return (
      <section className="jgis-story-editor-block">
        <div className="jgis-story-editor-label">{label}</div>
        {presetButtons}
        {customEditor}
      </section>
    );
  }

  return (
    <div className="jgis-story-editor-field">
      <span>{label}</span>
      {presetButtons}
      {customEditor}
    </div>
  );
}
