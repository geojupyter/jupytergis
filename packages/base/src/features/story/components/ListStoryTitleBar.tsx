import { IJupyterGISModel } from '@jupytergis/schema';
import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useListStoryScrollTrackContext } from '@/src/features/story/context/ListStoryScrollTrackContext';
import { useCurrentSegmentIndex } from '@/src/features/story/hooks/useCurrentSegmentIndex';
import type { IStorySegmentViewItem } from '@/src/features/story/types/types';
import { buildStorySegmentViewItems } from '@/src/features/story/utils/storySegmentViewItems';
import { Button } from '@/src/shared/components/Button';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';

interface IListStoryTitleBarProps {
  model: IJupyterGISModel;
  isMobile: boolean;
}

interface IListStoryTitleBarSegmentsProps {
  segmentItems: IStorySegmentViewItem[];
  currentIndex: number;
  onSegmentClick: (index: number) => void;
}

const ListStoryTitleBarSegments = React.forwardRef<
  HTMLDivElement,
  IListStoryTitleBarSegmentsProps
>(function ListStoryTitleBarSegments(
  { segmentItems, currentIndex, onSegmentClick },
  ref,
) {
  return (
    <div ref={ref} className="jgis-story-title-bar-segments">
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
  );
});

/**
 * Story stage title bar: one button per segment, labeled with the segment layer name.
 */
export function ListStoryTitleBar({
  model,
  isMobile,
}: IListStoryTitleBarProps): JSX.Element {
  const segmentsRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const currentIndex = useCurrentSegmentIndex(model);
  const { scrollToSegmentIndex } = useListStoryScrollTrackContext();

  const segmentItems = useMemo(
    () =>
      buildStorySegmentViewItems(model, model.getSelectedStory().story ?? null),
    [model],
  );

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

      scrollToSegmentIndex(nextItem.index);
    },
    [currentPosition, segmentItems, scrollToSegmentIndex],
  );

  useLayoutEffect(() => {
    if (isMobile) {
      return;
    }

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
  }, [isMobile]);

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
    <nav
      className={`jgis-story-title-bar${
        isMobile ? ' jgis-story-title-bar--mobile' : ''
      }`}
      aria-label="Story segments"
    >
      {isMobile ? (
        <Button
          type="button"
          variant="ghost"
          className="jgis-story-title-bar-menu-btn"
          aria-label="Open story menu"
        >
          <Menu />
        </Button>
      ) : null}
      {!isMobile && hasOverflow ? (
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
      <ListStoryTitleBarSegments
        ref={segmentsRef}
        segmentItems={segmentItems}
        currentIndex={currentIndex}
        onSegmentClick={scrollToSegmentIndex}
      />
      {!isMobile && hasOverflow ? (
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
