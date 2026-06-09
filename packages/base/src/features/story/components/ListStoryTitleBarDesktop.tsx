import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { IStorySegmentViewItem } from '@/src/features/story/types/types';
import { Button } from '@/src/shared/components/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface IListStoryTitleBarDesktopProps {
  segmentItems: IStorySegmentViewItem[];
  currentIndex: number;
  onSegmentClick: (index: number) => void;
}

export function ListStoryTitleBarDesktop({
  segmentItems,
  currentIndex,
  onSegmentClick,
}: IListStoryTitleBarDesktopProps): JSX.Element {
  const segmentsRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  const currentPosition = segmentItems.findIndex(
    item => item.index === currentIndex,
  );
  const hasPrev = currentPosition > 0;
  const hasNext =
    currentPosition >= 0 && currentPosition < segmentItems.length - 1;

  const goToAdjacentSegment = useCallback(
    (direction: -1 | 1): void => {
      const nextPosition = currentPosition + direction;
      const nextItem = segmentItems[nextPosition];
      if (!nextItem) {
        return;
      }

      onSegmentClick(nextItem.index);
    },
    [currentPosition, segmentItems, onSegmentClick],
  );

  useLayoutEffect(() => {
    const segments = segmentsRef.current;
    if (!segments) {
      return;
    }

    const update = (): void => {
      setHasOverflow(segments.scrollWidth > segments.clientWidth);
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(segments);

    return () => {
      ro.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const segments = segmentsRef.current;
    if (!segments) {
      return;
    }

    const active = segments.querySelector(
      '.jgis-story-title-bar-segment[data-state="active"]',
    );
    if (!(active instanceof HTMLElement)) {
      return;
    }

    active.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [currentIndex]);

  return (
    <nav className="jgis-story-title-bar" aria-label="Story segments">
      {hasOverflow ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="jgis-story-title-bar-scroll-btn"
          aria-label="Previous segment"
          disabled={!hasPrev}
          onClick={() => goToAdjacentSegment(-1)}
        >
          <ChevronLeft />
        </Button>
      ) : null}
      <div ref={segmentsRef} className="jgis-story-title-bar-segments">
        {segmentItems.map(item => {
          const isActive = item.index === currentIndex;
          return (
            <button
              key={item.id}
              type="button"
              className="jGIS-layer-browser-category jgis-story-title-bar-segment"
              data-state={isActive ? 'active' : 'inactive'}
              aria-current={isActive ? 'true' : undefined}
              aria-label={`Go to ${item.layerName}`}
              onClick={() => onSegmentClick(item.index)}
            >
              {item.layerName}
            </button>
          );
        })}
      </div>
      {hasOverflow ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="jgis-story-title-bar-scroll-btn"
          aria-label="Next segment"
          disabled={!hasNext}
          onClick={() => goToAdjacentSegment(1)}
        >
          <ChevronRight />
        </Button>
      ) : null}
    </nav>
  );
}
