import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';

import type { IStorySegmentViewItem } from '@/src/features/story/types/types';
import { getSegmentDisplayMode } from '@/src/features/story/utils/listStoryScrollTrack';
import { getStorySegmentDisplayTitle } from '@/src/features/story/utils/storySegmentViewItems';
import { Button } from '@/src/shared/components/Button';

export interface IStoryEditorSegmentListProps {
  segments: IStorySegmentViewItem[];
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string) => void;
  onAddSegment: () => void;
}

function SegmentListItem({
  segment,
  selected,
  onSelect,
}: {
  segment: IStorySegmentViewItem;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const stopType = getSegmentDisplayMode(segment.activeSlide);
  const title = getStorySegmentDisplayTitle(segment);

  return (
    <button
      type="button"
      className={`jgis-story-editor-segment-item${
        selected ? ' jgis-story-editor-segment-item--selected' : ''
      }`}
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
    >
      <span className="jgis-story-editor-segment-item-index">
        {segment.index + 1}.
      </span>
      <span className="jgis-story-editor-segment-item-title">{title}</span>
      <span className="jgis-story-editor-segment-item-type">
        {stopType === 'map' ? 'Map' : 'Text'}
      </span>
    </button>
  );
}

export function StoryEditorSegmentList({
  segments,
  selectedSegmentId,
  onSelectSegment,
  onAddSegment,
}: IStoryEditorSegmentListProps): JSX.Element {
  return (
    <aside className="jgis-story-editor-segment-list">
      <div className="jgis-story-editor-segment-list-header jgis-story-editor-eyebrow">
        Segments
      </div>
      <div className="jgis-story-editor-segment-list-items">
        {segments.length === 0 ? (
          <p className="jgis-story-editor-segment-list-empty jgis-story-editor-help">
            No segments yet. Add one from the current map view.
          </p>
        ) : (
          segments.map(segment => (
            <SegmentListItem
              key={segment.id}
              segment={segment}
              selected={segment.id === selectedSegmentId}
              onSelect={() => onSelectSegment(segment.id)}
            />
          ))
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="jgis-story-editor-add-segment"
        onClick={onAddSegment}
      >
        <FontAwesomeIcon icon={faPlus} /> Add segment
      </Button>
    </aside>
  );
}
