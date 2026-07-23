import { faGripVertical, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useCallback, useRef, useState } from 'react';

import type { IStorySegmentViewItem } from '@/src/features/story/types/types';
import { getSegmentDisplayMode } from '@/src/features/story/utils/listStoryScrollTrack';
import { getStorySegmentDisplayTitle } from '@/src/features/story/utils/storySegmentViewItems';
import { Button } from '@/src/shared/components/Button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';

export interface IStoryEditorSegmentListProps {
  segments: IStorySegmentViewItem[];
  selectedSegmentId: string | null;
  isMobile: boolean;
  onSelectSegment: (segmentId: string) => void;
  onAddSegment: () => void;
  onReorderSegments: (fromIndex: number, toIndex: number) => void;
}

function formatSegmentOptionLabel(segment: IStorySegmentViewItem): string {
  const title = getStorySegmentDisplayTitle(segment);
  const mode =
    getSegmentDisplayMode(segment.activeSlide) === 'map' ? 'Map' : 'Text';
  return `${segment.index + 1}. ${title} · ${mode}`;
}

function SegmentListItem({
  segment,
  selected,
  onSelect,
  index,
  canReorder,
  onDragStart,
}: {
  segment: IStorySegmentViewItem;
  selected: boolean;
  onSelect: () => void;
  index: number;
  canReorder: boolean;
  onDragStart: (index: number, event: React.DragEvent) => void;
}): JSX.Element {
  const segmentMode = getSegmentDisplayMode(segment.activeSlide);
  const title = getStorySegmentDisplayTitle(segment);

  return (
    <div className="jgis-story-editor-segment-row">
      {canReorder ? (
        <div
          className="jgis-story-editor-segment-drag-handle"
          draggable
          onDragStart={event => {
            onDragStart(index, event);
          }}
          title="Drag to reorder"
        >
          <FontAwesomeIcon icon={faGripVertical} />
        </div>
      ) : null}
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
          {segmentMode === 'map' ? 'Map' : 'Text'}
        </span>
      </button>
    </div>
  );
}

function MobileSegmentPicker({
  segments,
  selectedSegmentId,
  onSelectSegment,
  onAddSegment,
}: {
  segments: IStorySegmentViewItem[];
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string) => void;
  onAddSegment: () => void;
}): JSX.Element {
  return (
    <aside className="jgis-story-editor-segment-list jgis-story-editor-segment-list--mobile">
      {segments.length === 0 ? (
        <p className="jgis-story-editor-segment-list-empty jgis-story-editor-help">
          No segments yet. Add one from the current map view.
        </p>
      ) : (
        <NativeSelect
          className="jgis-story-editor-segment-picker"
          aria-label="Segment"
          value={selectedSegmentId ?? ''}
          onChange={event => {
            if (event.target.value) {
              onSelectSegment(event.target.value);
            }
          }}
        >
          {segments.map(segment => (
            <NativeSelectOption key={segment.id} value={segment.id}>
              {formatSegmentOptionLabel(segment)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
      <Button
        variant="outline"
        className="jgis-story-editor-add-segment"
        onClick={onAddSegment}
        aria-label="Add segment"
      >
        <FontAwesomeIcon icon={faPlus} />
      </Button>
    </aside>
  );
}

export function StoryEditorSegmentList({
  segments,
  selectedSegmentId,
  isMobile,
  onSelectSegment,
  onAddSegment,
  onReorderSegments,
}: IStoryEditorSegmentListProps): JSX.Element {
  const dragIndexRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const canReorder = segments.length > 1;

  const clearDragState = useCallback((): void => {
    dragIndexRef.current = null;
    dragOverRef.current = null;
    setDragOverIndex(null);
  }, []);

  const handleDragStart = useCallback(
    (index: number, event: React.DragEvent): void => {
      dragIndexRef.current = index;
      const wrapper = event.currentTarget.closest(
        '.jgis-story-editor-segment-drag-wrapper',
      );

      if (wrapper instanceof HTMLElement) {
        event.dataTransfer.setDragImage(wrapper, 0, 0);
      }
    },
    [],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      if (!canReorder) {
        return;
      }

      event.preventDefault();
      const wrappers = Array.from(
        event.currentTarget.querySelectorAll(
          ':scope > .jgis-story-editor-segment-drag-wrapper',
        ),
      );

      let index = segments.length;
      for (let i = 0; i < wrappers.length; i++) {
        const rect = wrappers[i].getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (event.clientY < midY) {
          index = i;
          break;
        }
      }

      dragOverRef.current = index;
      setDragOverIndex(index);
    },
    [canReorder, segments.length],
  );

  const handleDrop = useCallback((): void => {
    const over = dragOverRef.current;
    const from = dragIndexRef.current;

    if (from !== null && over !== null) {
      const to = over > from ? over - 1 : over;
      onReorderSegments(from, to);
    }

    clearDragState();
  }, [clearDragState, onReorderSegments]);

  if (isMobile) {
    return (
      <MobileSegmentPicker
        segments={segments}
        selectedSegmentId={selectedSegmentId}
        onSelectSegment={onSelectSegment}
        onAddSegment={onAddSegment}
      />
    );
  }

  return (
    <aside className="jgis-story-editor-segment-list">
      <div className="jgis-story-editor-segment-list-header jgis-story-editor-eyebrow">
        Segments
      </div>
      <div
        className="jgis-story-editor-segment-list-items"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={clearDragState}
      >
        {segments.length === 0 ? (
          <p className="jgis-story-editor-segment-list-empty jgis-story-editor-help">
            No segments yet. Add one from the current map view.
          </p>
        ) : (
          segments.map((segment, index) => (
            <div
              key={segment.id}
              className="jgis-story-editor-segment-drag-wrapper"
              style={{
                borderTop:
                  dragOverIndex === index && dragIndexRef.current !== index
                    ? '2px solid var(--jp-brand-color1)'
                    : '2px solid transparent',
                borderBottom:
                  dragOverIndex === segments.length &&
                  index === segments.length - 1 &&
                  dragIndexRef.current !== index
                    ? '2px solid var(--jp-brand-color1)'
                    : '2px solid transparent',
              }}
            >
              <SegmentListItem
                segment={segment}
                selected={segment.id === selectedSegmentId}
                onSelect={() => onSelectSegment(segment.id)}
                index={index}
                canReorder={canReorder}
                onDragStart={handleDragStart}
              />
            </div>
          ))
        )}
      </div>
      <Button
        variant="outline"
        className="jgis-story-editor-add-segment"
        onClick={onAddSegment}
      >
        <FontAwesomeIcon icon={faPlus} /> Add segment
      </Button>
    </aside>
  );
}
