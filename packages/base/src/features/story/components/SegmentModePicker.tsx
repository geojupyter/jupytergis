import { faBookOpen, faMap } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';

import type { StorySegmentDisplayMode } from '@/src/features/story/types/types';
import { Button } from '@/src/shared/components/Button';

export interface ISegmentModePickerProps {
  value: StorySegmentDisplayMode;
  onChange: (mode: StorySegmentDisplayMode) => void;
}

export function SegmentModePicker({
  value,
  onChange,
}: ISegmentModePickerProps): JSX.Element {
  const selectedValue: StorySegmentDisplayMode =
    value === 'markdown' ? 'markdown' : 'map';

  return (
    <section className="jgis-story-editor-block">
      <div className="jgis-story-editor-label">What is this segment?</div>
      <div className="jgis-story-editor-segment-mode-picker">
        <Button
          type="button"
          className={`jgis-story-editor-segment-mode-card${
            selectedValue === 'map'
              ? ' jgis-story-editor-segment-mode-card--selected'
              : ''
          }`}
          aria-pressed={selectedValue === 'map'}
          onClick={() => onChange('map')}
        >
          <div className="jgis-story-editor-row">
            <FontAwesomeIcon icon={faMap} />
            <strong>Map</strong>
          </div>
          <span>Saved map view with optional title and caption</span>
        </Button>
        <Button
          type="button"
          className={`jgis-story-editor-segment-mode-card${
            selectedValue === 'markdown'
              ? ' jgis-story-editor-segment-mode-card--selected'
              : ''
          }`}
          aria-pressed={selectedValue === 'markdown'}
          onClick={() => onChange('markdown')}
        >
          <div className="jgis-story-editor-row">
            <FontAwesomeIcon icon={faBookOpen} />
            <strong>Text</strong>
          </div>
          <span>Full-screen markdown chapter</span>
        </Button>
      </div>
    </section>
  );
}
