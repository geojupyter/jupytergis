import React, { useLayoutEffect, useMemo, useRef } from 'react';

import { ListStoryVirtualScrollTrack } from '@/src/features/story/components/ListStoryVirtualScrollTrack';
import { useListStoryScrollTrackContext } from '@/src/features/story/context/ListStoryScrollTrackContext';
import { useListStoryScroll } from '@/src/features/story/hooks/useListStoryScroll';
import type { IStoryPresentationMobileChromeProps } from '@/src/features/story/presentation/sharedChromeProps';
import { getSpectaPresentationStyle } from '@/src/features/story/utils/spectaPresentation';
import { buildStorySegmentViewItems } from '@/src/features/story/utils/storySegmentViewItems';

/**
 * Vertical-scroll chrome on mobile: full-viewport touch scroll on the virtual track.
 */
export function VerticalScrollPresentationMobile({
  model,
  storyData,
  currentIndex,
  setIndex,
  onSegmentTransitionChange,
}: IStoryPresentationMobileChromeProps): JSX.Element {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { scrollTrackLayout, bindScrollTrackElement } =
    useListStoryScrollTrackContext();

  const segmentViewItems = useMemo(
    () => buildStorySegmentViewItems(model, storyData),
    [model, storyData],
  );

  const presentationStyle = getSpectaPresentationStyle(storyData);

  useLayoutEffect(() => {
    bindScrollTrackElement(scrollContainerRef.current);
    return () => {
      bindScrollTrackElement(null);
    };
  }, [bindScrollTrackElement]);

  useListStoryScroll({
    enabled: Boolean(onSegmentTransitionChange),
    scrollContainerRef,
    storyData,
    scrollTrackLayout,
    items: segmentViewItems,
    currentIndex,
    setIndex,
    onSegmentTransitionChange,
  });

  return (
    <div
      ref={scrollContainerRef}
      id="jgis-story-segment-panel"
      className="jgis-story-viewer-panel-specta-mod-vertical-scroll jgis-story-mobile-list-scroll"
      style={presentationStyle}
    >
      <ListStoryVirtualScrollTrack scrollTrackLayout={scrollTrackLayout} />
    </div>
  );
}
