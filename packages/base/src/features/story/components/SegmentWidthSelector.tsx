import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  CSS_WIDTH_UNITS,
  parseCssWidth,
  resolveCssWidth,
  validateCssWidth,
} from '@/src/features/story/utils/cssWidth';
import { Input } from '@/src/shared/components/Input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/src/shared/components/ToggleGroup';

const CSS_AMOUNT_FRAGMENT = /^\d*\.?\d*$/;
const CSS_AMOUNT_COMPLETE = /^\d*\.?\d+$/;
const CUSTOM_PRESET_VALUE = 'custom';

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

export interface ISegmentWidthSelectorPreset {
  id: string;
  label: string;
  value: string;
}

export interface ISegmentWidthSelectorPickerProps {
  label: string;
  value: string | undefined;
  onChange: (width: string) => void;
  presets: readonly ISegmentWidthSelectorPreset[];
  presetGroupAriaLabel: string;
  layout?: 'field' | 'block';
  size?: React.ComponentProps<typeof ToggleGroupItem>['size'];
}

export function SegmentWidthSelector({
  label,
  value,
  onChange,
  presets,
  presetGroupAriaLabel,
  layout = 'field',
  size,
}: ISegmentWidthSelectorPickerProps): JSX.Element {
  const resolved = resolveCssWidth(value);
  const matchedPreset = presets.find(preset => preset.value === resolved);
  const parsed = parseCssWidth(resolved) ?? { amount: '', unit: '%' };
  const [isCustom, setIsCustom] = useState(() => matchedPreset === undefined);
  const [amount, setAmount] = useState(parsed.amount);
  const [unit, setUnit] = useState(parsed.unit);
  const [widthError, setWidthError] = useState<string | null>(null);
  const selectedPresetId = isCustom ? null : matchedPreset?.id;
  const toggleValue = isCustom
    ? CUSTOM_PRESET_VALUE
    : (selectedPresetId ?? undefined);

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

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // const [lockedWidth, setLockedWidth] = useState<number | null>(null);

  // TODO keep this? or stick with css (current)?
  // useLayoutEffect(() => {
  //   // If component mounts already in custom mode, lock to the toggle strip
  //   // width immediately (before the custom editor paints).
  //   if (isCustom && lockedWidth === null) {
  //     const w = wrapperRef.current?.getBoundingClientRect().width ?? null;
  //     if (w) {
  //       setLockedWidth(w);
  //     }
  //   }
  // }, []);

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
    <ToggleGroup
      variant="outline"
      spacing={0}
      size={size}
      className="[&_[data-slot=toggle-group-item]:first-child]:rounded-l-[0.5rem] [&_[data-slot=toggle-group-item]:last-child]:rounded-r-[0.5rem]"
      aria-label={presetGroupAriaLabel}
      value={toggleValue ? [toggleValue] : []}
      onValueChange={next => {
        const selected = next[0];
        if (!selected) {
          return;
        }

        // if (selected === CUSTOM_PRESET_VALUE) {
        //   // Capture wrapper width synchronously before the custom editor
        //   // mounts and expands the inline-flex container.
        //   const w = wrapperRef.current?.getBoundingClientRect().width ?? null;
        //   setLockedWidth(w);
        //   setIsCustom(true);
        //   return;
        // }

        const preset = presets.find(item => item.id === selected);
        if (!preset) {
          return;
        }

        // setLockedWidth(null);
        setIsCustom(false);
        onChange(preset.value);
      }}
    >
      {presets.map(preset => (
        <ToggleGroupItem key={preset.id} value={preset.id} title={preset.value}>
          {preset.label}
        </ToggleGroupItem>
      ))}
      <ToggleGroupItem value={CUSTOM_PRESET_VALUE}>Custom</ToggleGroupItem>
    </ToggleGroup>
  );

  const customEditor = isCustom ? (
    <>
      <div className="jgis-story-editor-width-custom">
        <Input
          aria-label={`${label} amount`}
          type="text"
          inputMode="decimal"
          value={amount}
          data-lm-suppress-shortcuts="true"
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

  const toggleAndCustom = (
    <div
      ref={wrapperRef}
      className="inline-flex flex-col gap-1"
      // style={lockedWidth !== null ? { width: lockedWidth } : undefined}
    >
      {presetButtons}
      {customEditor}
    </div>
  );

  if (layout === 'block') {
    return (
      <section className="jgis-story-editor-block">
        <div className="jgis-story-editor-label">{label}</div>
        {toggleAndCustom}
      </section>
    );
  }

  return (
    <div className="jgis-story-editor-field">
      <span>{label}</span>
      {toggleAndCustom}
    </div>
  );
}
