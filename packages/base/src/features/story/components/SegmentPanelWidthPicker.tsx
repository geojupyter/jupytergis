import React, { useEffect, useState } from 'react';

import {
  MAP_PANEL_WIDTH_PRESETS,
  resolveSegmentPanelWidth,
} from '@/src/features/story/utils/storySegmentContent';
import { Button } from '@/src/shared/components/Button';
import { Input } from '@/src/shared/components/Input';

const CSS_AMOUNT_FRAGMENT = /^\d*\.?\d*$/;
const CSS_AMOUNT_COMPLETE = /^\d*\.?\d+$/;

function sanitizePercentAmountInput(raw: string): string {
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

export interface ISegmentPanelWidthPickerProps {
  value: string | undefined;
  onChange: (width: string) => void;
}

export function SegmentPanelWidthPicker({
  value,
  onChange,
}: ISegmentPanelWidthPickerProps): JSX.Element {
  const resolved = resolveSegmentPanelWidth(
    value ? { contentMode: 'map', panelWidth: value } : { contentMode: 'map' },
  );
  const matchedPreset = resolved
    ? MAP_PANEL_WIDTH_PRESETS.find(preset => preset === resolved)
    : undefined;
  const [isCustom, setIsCustom] = useState(Boolean(resolved && !matchedPreset));
  const [amount, setAmount] = useState(
    resolved?.replace(/%$/, '') ?? '',
  );
  const [widthError, setWidthError] = useState<string | null>(null);
  const selectedPreset = isCustom ? undefined : matchedPreset;

  useEffect(() => {
    const nextResolved = resolveSegmentPanelWidth(
      value ? { contentMode: 'map', panelWidth: value } : { contentMode: 'map' },
    );
    const nextPreset = nextResolved
      ? MAP_PANEL_WIDTH_PRESETS.find(preset => preset === nextResolved)
      : undefined;
    setIsCustom(Boolean(nextResolved && !nextPreset));
    setAmount(nextResolved?.replace(/%$/, '') ?? '');
    setWidthError(null);
  }, [value]);

  return (
    <section className="jgis-story-editor-block">
      <div className="jgis-story-editor-label">Panel width</div>
      <div
        className="jgis-story-editor-width-presets"
        role="group"
        aria-label="Map panel width presets"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`jgis-story-editor-width-preset${
            !resolved ? ' jgis-story-editor-width-preset--selected' : ''
          }`}
          aria-pressed={!resolved}
          title="25% (layout default)"
          onClick={() => {
            setIsCustom(false);
            onChange('');
          }}
        >
          Default
        </Button>
        {MAP_PANEL_WIDTH_PRESETS.map(preset => (
          <Button
            key={preset}
            type="button"
            variant="outline"
            size="sm"
            className={`jgis-story-editor-width-preset${
              selectedPreset === preset
                ? ' jgis-story-editor-width-preset--selected'
                : ''
            }`}
            aria-pressed={selectedPreset === preset}
            title={preset}
            onClick={() => {
              setIsCustom(false);
              onChange(preset);
            }}
          >
            {preset}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`jgis-story-editor-width-preset${
            isCustom ? ' jgis-story-editor-width-preset--selected' : ''
          }`}
          aria-pressed={isCustom}
          onClick={() => {
            setIsCustom(true);
          }}
        >
          Custom
        </Button>
      </div>
      {isCustom ? (
        <>
          <div className="jgis-story-editor-width-custom">
            <Input
              aria-label="Panel width percent"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={event => {
                const nextAmount = sanitizePercentAmountInput(
                  event.target.value,
                );
                setAmount(nextAmount);

                if (!CSS_AMOUNT_COMPLETE.test(nextAmount)) {
                  setWidthError('Enter a valid width');
                  return;
                }

                const numeric = Number(nextAmount);
                if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 100) {
                  setWidthError('Enter a value between 1 and 100');
                  return;
                }

                setWidthError(null);
                onChange(`${nextAmount}%`);
              }}
            />
            <span className="jgis-story-editor-width-unit">%</span>
          </div>
          {widthError ? (
            <p className="jgis-story-editor-field-error">{widthError}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
