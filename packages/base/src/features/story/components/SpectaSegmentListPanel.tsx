import { IJGISStoryMap } from '@jupytergis/schema';
import React, { RefObject, useRef } from 'react';

import StoryViewerPanel from '@/src/features/story/StoryViewerPanel';
import { useListStorySegmentScrollPadding } from '@/src/features/story/hooks/useListStorySegmentScrollPadding';
import { IStorySegmentViewItem } from '@/src/features/story/hooks/useStorySegmentViewItems';

interface ISpectaSegmentListPanelProps {
  isSpecta: boolean;
  storyData: IJGISStoryMap | null;
  items: IStorySegmentViewItem[];
  handlePrev: () => void;
  handleNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  /** The Specta story column scroller (`#jgis-story-segment-panel` root). */
  listIntersectionRootRef: RefObject<HTMLDivElement | null>;
}

export function SpectaSegmentListPanel({
  isSpecta,
  storyData,
  items,
  handlePrev,
  handleNext,
  hasPrev,
  hasNext,
  listIntersectionRootRef,
}: ISpectaSegmentListPanelProps): JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);

  useListStorySegmentScrollPadding(
    listIntersectionRootRef,
    listRef,
    items.length,
  );

  if (!storyData || !items.length) {
    return <div style={{ padding: '1rem' }}>No segments.</div>;
  }

  return (
    <div ref={listRef} className="jgis-story-segment-list">
      {items.map(item => {
        const isMarkdownSegment =
          item.activeSlide?.content?.contentMode === 'markdown';
        return (
          <div
            key={item.id}
            data-segment-id={item.id}
            className={`jgis-story-segment-card ${isMarkdownSegment ? 'jgis-story-segment-card-hidden' : ''}`}
          >
            <StoryViewerPanel
              isSpecta={isSpecta}
              isMobile={true}
              storyData={storyData}
              currentIndex={item.index}
              activeSlide={item.activeSlide}
              layerName={item.layerName}
              handlePrev={handlePrev}
              handleNext={handleNext}
              hasPrev={hasPrev}
              hasNext={hasNext}
            />
          </div>
        );
      })}
    </div>
  );
}
