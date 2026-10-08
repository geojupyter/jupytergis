import React from 'react';

import type { StorySegmentPaneAlignment } from '@/src/features/story/types/types';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/src/shared/components/ToggleGroup';

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
      <ToggleGroup
        variant="outline"
        spacing={0}
        className="[&_[data-slot=toggle-group-item]:first-child]:rounded-l-[0.5rem] [&_[data-slot=toggle-group-item]:last-child]:rounded-r-[0.5rem]"
        aria-label="Pane alignment"
        value={[value]}
        onValueChange={next => {
          const alignment = next[0] as StorySegmentPaneAlignment | undefined;
          if (alignment) {
            onChange(alignment);
          }
        }}
      >
        {PANE_ALIGNMENT_OPTIONS.map(option => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </section>
  );
}
