import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useLayoutEffect, useRef, useState } from 'react';

import type { IListStoryTitleBarContentProps } from '@/src/features/story/types/types';
import { ButtonTw } from '@/src/shared/components/ButtonTw';

export function ListStoryTitleBarDesktop({
  segmentItems,
  currentIndex,
  onSegmentClick,
}: IListStoryTitleBarContentProps): JSX.Element {
  const segmentsRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  const currentPosition = segmentItems.findIndex(
    item => item.index === currentIndex,
  );
  const hasPrev = currentPosition > 0;
  const hasNext =
    currentPosition >= 0 && currentPosition < segmentItems.length - 1;

  const goToAdjacentSegment = (direction: -1 | 1): void => {
    const nextPosition = currentPosition + direction;
    const nextItem = segmentItems[nextPosition];
    if (!nextItem) {
      return;
    }

    onSegmentClick(nextItem.index);
  };

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

    if (!active) {
      return;
    }

    active.scrollIntoView({
      behavior: 'smooth',
    });
  }, [currentIndex]);

  return (
    <nav className="jgis-story-title-bar" aria-label="Story segments">
      {hasOverflow ? (
        <ButtonTw
          type="button"
          variant="ghost"
          aria-label="Previous segment"
          disabled={!hasPrev}
          onClick={() => goToAdjacentSegment(-1)}
        >
          <ChevronLeft />
        </ButtonTw>
      ) : null}
      <div
        ref={segmentsRef}
        className="jgis-story-title-bar-segments"
        onWheelCapture={event => event.stopPropagation()}
      >
        {segmentItems.map(item => {
          const isActive = item.index === currentIndex;
          return (
            <button
              key={item.id}
              type="button"
              className="jgis-underline-indicator jgis-story-title-bar-label jgis-story-title-bar-segment"
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
        <ButtonTw
          type="button"
          variant="ghost"
          aria-label="Next segment"
          disabled={!hasNext}
          onClick={() => goToAdjacentSegment(1)}
        >
          <ChevronRight />
        </ButtonTw>
      ) : null}
    </nav>
  );
}
