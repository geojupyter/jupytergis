import { faChartSimple } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Encoding, IScale } from '@jupytergis/schema';
import React from 'react';

import { NumericInput } from '@/src/features/layers/symbology/components/NumericInput';
import { TEXT_ENUM_OPTIONS } from '@/src/features/layers/symbology/components/ScaleEditor';
import RgbaColorPicker, {
  RgbaColor,
} from '@/src/features/layers/symbology/components/color_ramp/RgbaColorPicker';
import { Input } from '@/src/shared/components/Input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';

/** Families offered for a label font, matching the CSS generic keywords. */
const FONT_FAMILIES = ['sans-serif', 'serif', 'monospace', 'cursive'];

export function isConstantScale(scale: IScale): boolean {
  return (
    scale.scheme === 'constant_num' ||
    scale.scheme === 'constant_str' ||
    scale.scheme === 'constant_rgba'
  );
}

/**
 * The scheme a fixed value turns into when it should follow the data.
 *
 * Collapsing constants into controls takes their scheme dropdown away, so
 * without this the only route from a fixed colour to a colour ramp would be
 * deleting the channel and adding it back.
 */
export function dataDrivenSchemeFor(scale: IScale): IScale['scheme'] | null {
  switch (scale.scheme) {
    case 'constant_rgba':
      return 'colorMap';
    case 'constant_num':
      return 'scalar';
    case 'constant_str':
      return 'identity';
    default:
      return null;
  }
}

interface IInlineConstantProps {
  scale: IScale;
  encodings: Encoding[];
  onChange: (scale: IScale) => void;
  /** Turn this channel into a full row driven by a field. */
  onPromote?: () => void;
}

/**
 * A constant mapping as a single control.
 *
 * A constant needs no input field, no classification and no stops, so the row
 * machinery around it is all scaffolding. Rendering it as one spinner, swatch
 * or dropdown is what lets a label read as one entry with its styling attached
 * rather than a stack of near-empty rows.
 */
const InlineConstant: React.FC<IInlineConstantProps> = ({
  scale,
  encodings,
  onChange,
  onPromote,
}) => {
  const promote = onPromote && (
    <button
      type="button"
      className="jp-gis-inline-constant-promote"
      onClick={onPromote}
      title="Drive this from a data field"
    >
      <FontAwesomeIcon icon={faChartSimple} />
    </button>
  );

  if (scale.scheme === 'constant_num') {
    return (
      <>
        <NumericInput
          className="jp-gis-inline-constant-num"
          value={scale.params.value}
          onChange={value =>
            onChange({ scheme: 'constant_num', params: { value } })
          }
        />
        {promote}
      </>
    );
  }

  if (scale.scheme === 'constant_rgba') {
    return (
      <>
        <RgbaColorPicker
          color={scale.params.value as RgbaColor}
          onChange={value =>
            onChange({ scheme: 'constant_rgba', params: { value } })
          }
        />
        {promote}
      </>
    );
  }

  if (scale.scheme === 'constant_str') {
    const enumEncoding = encodings.find(c => c in TEXT_ENUM_OPTIONS);
    const options = enumEncoding
      ? TEXT_ENUM_OPTIONS[enumEncoding]
      : encodings.includes('text-font-family')
        ? FONT_FAMILIES
        : undefined;

    const set = (value: string) =>
      onChange({ scheme: 'constant_str', params: { value } });

    return (
      <>
        {options ? (
          <NativeSelect
            className="jp-gis-inline-constant-select"
            value={scale.params.value}
            onChange={e => set(e.target.value)}
          >
            {options.map(o => (
              <NativeSelectOption key={o} value={o}>
                {o}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : (
          <Input
            className="jp-mod-styled jp-gis-inline-constant-text"
            value={scale.params.value}
            onChange={e => set(e.target.value)}
          />
        )}
        {promote}
      </>
    );
  }

  return null;
};

export default InlineConstant;
