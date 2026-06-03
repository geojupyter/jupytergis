import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useCallback, useMemo, useRef } from 'react';

import { useListStoryScrollTrackContext } from '@/src/features/story/context/ListStoryScrollTrackContext';
import { useCurrentSegmentIndex } from '@/src/features/story/hooks/useCurrentSegmentIndex';
import { buildStorySegmentViewItems } from '@/src/features/story/utils/storySegmentViewItems';
import { Button } from '@/src/shared/components/Button';

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
      buildStorySegmentViewItems(
        model,
        model.getSelectedStory().story ?? null,
      ),
    [model],
  );

  return (
    <nav className="jgis-story-title-bar" aria-label="Story segments">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="jgis-story-title-bar-scroll-btn"
        aria-label="Scroll segments left"
        onClick={() => scrollSegments(-1)}
      >
        ‹
      </Button>
      <div ref={segmentsRef} className="jgis-story-title-bar-segments">
        {segmentItems.map(item => (
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            size="sm"
            className="jgis-story-title-bar-segment"
            aria-current={item.index === currentIndex ? 'true' : undefined}
            aria-label={`Go to ${item.layerName}`}
            onClick={() => scrollToSegmentIndex(item.index)}
          >
            {item.layerName}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="jgis-story-title-bar-scroll-btn"
        aria-label="Scroll segments right"
        onClick={() => scrollSegments(1)}
      >
        ›
      </Button>
    </nav>
  );
}
