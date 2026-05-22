import { IJGISStoryMap } from '@jupytergis/schema';
import React, { RefObject, useEffect, useRef } from 'react';

import { useListStoryLayoutContext } from '@/src/features/story/context/ListStoryLayoutContext';
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
  storyData,
  items,
  listIntersectionRootRef,
}: ISpectaSegmentListPanelProps): JSX.Element {
  const trackRootRef = useRef<HTMLDivElement>(null);
  const { layout, bindScrollContainer } = useListStoryLayoutContext();

  useEffect(() => {
    bindScrollContainer(listIntersectionRootRef.current);
    return () => {
      bindScrollContainer(null);
    };
  }, [bindScrollContainer, listIntersectionRootRef]);

  useListStorySegmentScrollPadding(
    listIntersectionRootRef,
    trackRootRef,
    layout,
  );

  if (!storyData || !layout) {
    return <div style={{ padding: '1rem' }}>No segments.</div>;
  }

  return (
    <div ref={trackRootRef} className="jgis-story-virtual-track-root">
      <div
        className="jgis-story-virtual-track"
        style={{ height: layout.trackHeight }}
        aria-hidden
      />
    </div>
  );
}
