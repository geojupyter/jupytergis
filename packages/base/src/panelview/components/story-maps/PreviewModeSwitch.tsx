import * as React from 'react';

import { Switch } from '@/src/shared/components/Switch';

interface IPreviewModeSwitchProps {
  checked: boolean;
  onCheckedChange: () => void;
}

export function PreviewModeSwitch({
  checked,
  onCheckedChange,
}: IPreviewModeSwitchProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '1rem',
      }}
    >
      <label htmlFor="preview-mode-switch" style={{ fontSize: '0.875rem' }}>
        Preview Mode
      </label>
      <Switch
        id="preview-mode-switch"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
