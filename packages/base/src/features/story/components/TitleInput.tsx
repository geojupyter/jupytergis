import React, { useEffect, useState } from 'react';

import { PenLine } from 'lucide-react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/src/shared/components/InputGroup';
import { cn } from '@/src/shared/components/utils';

export function TitleInput({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: string;
  onChange: (title: string) => void;
  disabled?: boolean;
  className?: string;
}): JSX.Element {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <InputGroup className={cn('jgis-story-editor-toolbar-title', className)}>
      <InputGroupInput
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
      <InputGroupAddon style={{ paddingLeft: '0.125rem' }} align="inline-start">
        <PenLine className="jgis-inline-icon" />
      </InputGroupAddon>
    </InputGroup>
  );
}
