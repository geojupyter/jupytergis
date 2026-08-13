import React, { useEffect, useState } from 'react';

import { Input } from '@/src/shared/components/Input';

export function TitleInput({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (title: string) => void;
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
      placeholder="No Story"
      disabled={disabled}
      aria-label="Title"
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
