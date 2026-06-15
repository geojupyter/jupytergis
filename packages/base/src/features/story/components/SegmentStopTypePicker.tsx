import { faMap } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';

import type { StorySegmentDisplayMode } from '@/src/features/story/types/types';

export interface ISegmentStopTypePickerProps {
  value: StorySegmentDisplayMode;
  onChange: (mode: StorySegmentDisplayMode) => void;
}

export function SegmentStopTypePicker({
  value,
  onChange,
}: ISegmentStopTypePickerProps): JSX.Element {
  return (
    <section className="jgis-story-editor-section">
      <div className="jgis-story-editor-section-label">
        What is this stop?
      </div>
      <div className="jgis-story-editor-stop-type-picker">
        <button
          type="button"
          className={`jgis-story-editor-stop-type-card${
            value === 'map'
              ? ' jgis-story-editor-stop-type-card--selected'
              : ''
          }`}
          aria-pressed={value === 'map'}
          onClick={() => onChange('map')}
        >
          <div style={{ display: 'flex', gap: '1rem' }}>
            <FontAwesomeIcon icon={faMap} />
            <strong>Map stop</strong>
          </div>
          <span>Saved map view with optional title and caption</span>
        </button>
        <button
          type="button"
          className={`jgis-story-editor-stop-type-card${
            value === 'markdown'
              ? ' jgis-story-editor-stop-type-card--selected'
              : ''
          }`}
          aria-pressed={value === 'markdown'}
          onClick={() => onChange('markdown')}
        >
          <strong>Text stop</strong>
          <span>Full-screen markdown chapter</span>
        </button>
      </div>
    </section>
  );
}
