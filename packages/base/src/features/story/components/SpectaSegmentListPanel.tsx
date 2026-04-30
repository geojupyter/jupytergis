import { IJGISStoryMap } from '@jupytergis/schema';
import React, { useEffect, useRef } from 'react';

import StoryViewerPanel from '@/src/features/story/StoryViewerPanel';
import { IStorySegmentViewItem } from '@/src/features/story/hooks/useStorySegmentViewItems';

interface ISpectaSegmentListPanelProps {
  isSpecta: boolean;
  storyData: IJGISStoryMap | null;
  items: IStorySegmentViewItem[];
  currentIndex: number;
  setIndex: (index: number) => void;
  handlePrev: () => void;
  handleNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function SpectaSegmentListPanel({
  isSpecta,
  storyData,
  items,
  currentIndex,
  setIndex,
  handlePrev,
  handleNext,
  hasPrev,
  hasNext,
}: ISpectaSegmentListPanelProps): JSX.Element {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const visibleIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!items.length) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const segmentId = entry.target.getAttribute('data-segment-id');
          if (!segmentId) {
            return;
          }
          if (entry.isIntersecting) {
            visibleIdsRef.current.add(segmentId);
          } else {
            visibleIdsRef.current.delete(segmentId);
          }
        });

        const firstVisible = items.find(item =>
          visibleIdsRef.current.has(item.id),
        );
        if (firstVisible && firstVisible.index !== currentIndex) {
          setIndex(firstVisible.index);
        }
      },
      {
        threshold: 0.1,
      },
    );

    items.forEach(item => {
      const card = cardRefs.current[item.id];
      if (card) {
        observer.observe(card);
      }
    });

    return () => {
      observer.disconnect();
      visibleIdsRef.current.clear();
    };
  }, [items, currentIndex, setIndex]);

  if (!storyData || !items.length) {
    return <div style={{ padding: '1rem' }}>No segments.</div>;
  }

  return (
    <div className="jgis-story-segment-list">
      {items.map(item => {
        return (
          <div
            key={item.id}
            data-segment-id={item.id}
            ref={element => {
              cardRefs.current[item.id] = element;
            }}
            className={`jgis-story-segment-card ${
              item.isActive ? 'jgis-story-segment-card-active' : ''
            }`}
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
