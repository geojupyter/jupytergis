import { IJGISStoryMap } from '@jupytergis/schema';
import React, { RefObject, useEffect, useRef } from 'react';

import StoryViewerPanel from '@/src/features/story/StoryViewerPanel';
import { IStorySegmentViewItem } from '@/src/features/story/hooks/useStorySegmentViewItems';

const ROOT_EDGE_TOLERANCE_PX = 2;

/**
 * True when card (a .jgis-story-segment-card) lies fully
 * inside the list scroller viewport, or when the card is taller than the
 * viewport and the visible strip fills the viewport height.
 */
function isCardFullyVisibleInScroller(
  card: HTMLElement,
  scroller: HTMLElement,
): boolean {
  const c = card.getBoundingClientRect();
  const s = scroller.getBoundingClientRect();

  if (c.height <= s.height + ROOT_EDGE_TOLERANCE_PX) {
    return (
      c.top >= s.top - ROOT_EDGE_TOLERANCE_PX &&
      c.bottom <= s.bottom + ROOT_EDGE_TOLERANCE_PX
    );
  }

  const visibleTop = Math.max(c.top, s.top);
  const visibleBottom = Math.min(c.bottom, s.bottom);
  const visibleHeight = visibleBottom - visibleTop;
  return visibleHeight >= s.height - ROOT_EDGE_TOLERANCE_PX;
}

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
  /** The Specta story column scroller (`#jgis-story-segment-panel` root). */
  listIntersectionRootRef: RefObject<HTMLDivElement | null>;
}

// ! TODO this should be the SpectaListModeContent
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
  listIntersectionRootRef,
}: ISpectaSegmentListPanelProps): JSX.Element {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  useEffect(() => {
    if (!items.length) {
      return;
    }

    const root = listIntersectionRootRef.current;
    if (!root) {
      return;
    }

    /** Picks the topmost fully-visible card index as the active segment. */
    const syncActiveFromLayout = (): void => {
      const fullyVisibleIndices: number[] = [];

      for (const item of items) {
        const card = cardRefs.current[item.id];
        if (!card) {
          continue;
        }
        if (isCardFullyVisibleInScroller(card, root)) {
          fullyVisibleIndices.push(item.index);
        }
      }

      if (!fullyVisibleIndices.length) {
        return;
      }

      // Choose smallest index in case multiple cards fit
      const nextIndex = Math.min(...fullyVisibleIndices);
      if (nextIndex !== currentIndexRef.current) {
        setIndex(nextIndex);
      }
    };

    const observer = new IntersectionObserver(
      () => {
        syncActiveFromLayout();
      },
      {
        root,
        rootMargin: '0px',
        threshold: [0, 0.01, 0.5, 1],
      },
    );

    items.forEach(item => {
      const card = cardRefs.current[item.id];
      if (card) {
        observer.observe(card);
      }
    });

    syncActiveFromLayout();

    return () => {
      observer.disconnect();
    };
  }, [items, setIndex, listIntersectionRootRef]);

  if (!storyData || !items.length) {
    return <div style={{ padding: '1rem' }}>No segments.</div>;
  }

  return (
    <div className="jgis-story-segment-list">
      {items.map(item => {
        const isMarkdownSegment =
          item.activeSlide?.content?.contentMode === 'markdown';
        return (
          <div
            key={item.id}
            data-segment-id={item.id}
            ref={element => {
              cardRefs.current[item.id] = element;
            }}
            className={`jgis-story-segment-card ${
              item.isActive ? 'jgis-story-segment-card-active' : ''
            }${isMarkdownSegment ? ' jgis-story-segment-card-hidden' : ''}`}
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
