import { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import React, { useLayoutEffect, useMemo, useRef } from 'react';

import { ListStoryVirtualScrollTrack } from '@/src/features/story/components/ListStoryVirtualScrollTrack';
import { useListStoryScrollTrackContext } from '@/src/features/story/context/ListStoryScrollTrackContext';
import { useListStoryScroll } from '@/src/features/story/hooks/useListStoryScroll';
import type { IListStorySegmentTransition } from '@/src/features/story/types/types';
import { getSpectaPresentationStyle } from '@/src/features/story/utils/spectaPresentation';
import { buildStorySegmentViewItems } from '@/src/features/story/utils/storySegmentViewItems';
import { STORY_TYPE } from '@/src/types';

export interface ISpectaMobileListModeContentProps {
  model: IJupyterGISModel;
  storyData: IJGISStoryMap | null;
  currentIndex: number;
  setIndex: (index: number) => void;
  onSegmentTransitionChange?: (
    payload: IListStorySegmentTransition | null,
  ) => void;
}

/**
 * Mobile list story: full-viewport touch scroll on the virtual track drives
 */
export function SpectaMobileListModeContent({
  model,
  storyData,
  currentIndex,
  setIndex,
  onSegmentTransitionChange,
}: ISpectaMobileListModeContentProps): JSX.Element {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { scrollTrackLayout, bindScrollTrackElement } =
    useListStoryScrollTrackContext();

  const segmentViewItems = useMemo(
    () => buildStorySegmentViewItems(model, storyData),
    [model, storyData],
  );

  const presentationStyle = getSpectaPresentationStyle(storyData);

  const segmentTransitionSyncEnabled =
    Boolean(onSegmentTransitionChange) &&
    storyData?.storyType === STORY_TYPE.verticalScroll;

  useLayoutEffect(() => {
    bindScrollTrackElement(scrollContainerRef.current);
    return () => {
      bindScrollTrackElement(null);
    };
  }, [bindScrollTrackElement]);

  useListStoryScroll({
    enabled: segmentTransitionSyncEnabled,
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
