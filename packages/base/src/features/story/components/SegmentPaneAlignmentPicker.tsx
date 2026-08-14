import React from 'react';

import type { StorySegmentPaneAlignment } from '@/src/features/story/types/types';
import { Button } from '@/src/shared/components/Button';
import { ButtonGroup } from '@/src/shared/components/ButtonGroup';

const PANE_ALIGNMENT_OPTIONS: {
  value: StorySegmentPaneAlignment;
  label: string;
}[] = [
  { value: 'start', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'Right' },
];

export interface ISegmentPaneAlignmentPickerProps {
  value: StorySegmentPaneAlignment;
  onChange: (alignment: StorySegmentPaneAlignment) => void;
}

export function SegmentPaneAlignmentPicker({
  value,
  onChange,
}: ISegmentPaneAlignmentPickerProps): JSX.Element {
  return (
    <section className="jgis-story-editor-block">
      <div className="jgis-story-editor-label">Pane alignment</div>
      <ButtonGroup
        className="jgis-story-editor-pane-alignment-picker"
        aria-label="Pane alignment"
      >
        {PANE_ALIGNMENT_OPTIONS.map(option => (
          <Button
            key={option.value}
            type="button"
            variant="outline"
            className={
              value === option.value
                ? 'jgis-story-editor-pane-alignment-button--selected'
                : undefined
            }
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </ButtonGroup>
    </section>
  );
}
