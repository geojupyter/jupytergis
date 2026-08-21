import React, { useEffect, useState } from 'react';

import { Input } from '@/src/shared/components/Input';

export function StoryEditorInput({
  value,
  onChange,
  placeholder,
  'aria-label': ariaLabel,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  'aria-label': string;
  disabled?: boolean;
}): JSX.Element {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <Input
      className="jgis-story-editor-toolbar-title"
      value={disabled ? '' : draft}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={event => {
        setDraft(event.target.value);
      }}
      onKeyDown={event => {
        if (disabled) {
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
      onBlur={() => {
        if (!disabled && draft !== value) {
          onChange(draft);
        }
      }}
    />
  );
}
