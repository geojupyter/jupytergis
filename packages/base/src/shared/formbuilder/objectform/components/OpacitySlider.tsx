import { FieldProps } from '@rjsf/utils';
import React from 'react';

import { Slider } from '@/src/shared/components/Slider';

function OpacitySlider({ formData, onChange }: FieldProps<number>) {
  const opacityPercent = Math.round((formData ?? 1) * 100);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Slider
        min={0}
        max={100}
        step={10}
        value={[opacityPercent]}
        aria-label="Opacity"
        onValueChange={value => {
          const next = Array.isArray(value) ? value[0] : value;
          onChange(next / 100);
        }}
      />
      <span
        style={{
          minWidth: '2.5rem',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--jp-ui-font-color2)',
        }}
      >
        {opacityPercent}%
      </span>
    </div>
  );
}

export default OpacitySlider;
