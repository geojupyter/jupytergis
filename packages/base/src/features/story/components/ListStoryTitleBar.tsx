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
import { buildStorySegmentViewItems } from '@/src/features/story/utils/storySegmentViewItems';
import { Button } from '@/src/shared/components/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface IListStoryTitleBarProps {
  model: IJupyterGISModel;
}

/**
 * Story stage title bar: one button per segment, labeled with the segment layer name.
 */
export function ListStoryTitleBar({
  model,
}: IListStoryTitleBarProps): JSX.Element {
  const segmentsRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const currentIndex = useCurrentSegmentIndex(model);
  const { scrollToSegmentIndex } = useListStoryScrollTrackContext();

  const scrollSegments = useCallback((direction: -1 | 1): void => {
    const segments = segmentsRef.current;
    if (!segments) {
      return;
    }

    const amount = Math.max(120, segments.clientWidth * 0.6);
    segments.scrollBy({ left: direction * amount, behavior: 'smooth' });
  }, []);

  const segmentItems = useMemo(
    () =>
      buildStorySegmentViewItems(model, model.getSelectedStory().story ?? null),
    [model],
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

  return (
    <nav className="jgis-story-title-bar" aria-label="Story segments">
      {hasOverflow ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="jgis-story-title-bar-scroll-btn"
          aria-label="Scroll segments left"
          onClick={() => scrollSegments(-1)}
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
              className="jGIS-layer-browser-category jgis-story-title-bar-segment"
              data-state={isActive ? 'active' : 'inactive'}
              aria-current={isActive ? 'true' : undefined}
              aria-label={`Go to ${item.layerName}`}
              onClick={() => scrollToSegmentIndex(item.index)}
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
          aria-label="Scroll segments right"
          onClick={() => scrollSegments(1)}
        >
          <ChevronRight />
        </Button>
      ) : null}
    </nav>
  );
}
