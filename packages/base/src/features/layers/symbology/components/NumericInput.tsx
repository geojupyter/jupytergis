/**
 * A numeric text input that accepts scientific notation (e.g. 1e-5, 3.2e+10).
 *
 * Uses type="text" internally so the browser never rejects or silently rounds
 * values. The parsed number is committed to the parent only on blur; while the
 * user is typing the raw string is kept in local state.
 *
 * Invalid strings (non-finite after parsing) are highlighted and the field
 * resets to the last valid value on blur.
 */

import React, { useEffect, useRef, useState } from 'react';

import { Input } from '@/src/shared/components/Input';

interface INumericInputProps {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const NumericInput: React.FC<INumericInputProps> = ({
  value,
  onChange,
  placeholder,
  className,
  style,
}) => {
  const [raw, setRaw] = useState(() => String(value));
  const focused = useRef(false);

  // Sync from parent when the field is not being edited and the value differs.
  useEffect(() => {
    if (!focused.current && Number(raw) !== value) {
      setRaw(String(value));
    }
  }, [value]); // intentionally excludes `raw` to avoid clobbering user input

  const commit = () => {
    focused.current = false;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '-') {
      // Incomplete entry — reset to last valid value.
      setRaw(String(value));
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      onChange(parsed);
    } else {
      setRaw(String(value));
    }
  };

  // Highlight the field when the current string is clearly invalid.
  const trimmed = raw.trim();
  const isValid =
    trimmed === '' || trimmed === '-' || Number.isFinite(Number(trimmed));

  return (
    <Input
      className={className}
      style={style}
      type="text"
      placeholder={placeholder}
      value={raw}
      aria-invalid={!isValid}
      onChange={e => setRaw(e.target.value)}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={commit}
    />
  );
};
