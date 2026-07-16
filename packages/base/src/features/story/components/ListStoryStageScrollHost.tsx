import type { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import React, {
  type RefObject,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { ListStoryVirtualScrollTrack } from '@/src/features/story/components/ListStoryVirtualScrollTrack';
import { useListStoryScrollTrackContext } from '@/src/features/story/context/ListStoryScrollTrackContext';
import { useListStoryScroll } from '@/src/features/story/hooks/useListStoryScroll';
import { useStoryMap } from '@/src/features/story/hooks/useStoryMap';
import type {
  IOverrideLayerEntry,
  IListStorySegmentTransition,
} from '@/src/features/story/types/types';
import { getSpectaPresentationStyle } from '@/src/features/story/utils/spectaPresentation';
import { buildStorySegmentViewItems } from '@/src/features/story/utils/storySegmentViewItems';

interface IListStoryStageScrollHostProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  isMobile: boolean;
  initialLayersReady: boolean;
  scrollContainerRef: RefObject<HTMLDivElement>;
  addLayer: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer: (id: string) => void;
  onSegmentTransitionChange: (
    payload: IListStorySegmentTransition | null,
  ) => void;
}

/**
 * Vertical-scroll scrollport on the map stage (desktop + mobile).
 */
export function ListStoryStageScrollHost({
  model,
  isSpecta,
  isMobile,
  initialLayersReady,
  scrollContainerRef,
  addLayer,
  removeLayer,
  onSegmentTransitionChange,
}: IListStoryStageScrollHostProps): JSX.Element | null {
  const overrideLayerEntriesRef = useRef<IOverrideLayerEntry[]>([]);
  const { storyData, currentIndex, setIndex } = useStoryMap({
    model,
    overrideLayerEntriesRef,
    removeLayer,
    addLayer,
    isSpecta,
  });

  const segmentViewItems = useMemo(
    () => buildStorySegmentViewItems(model, storyData),
    [model, storyData],
  );

  const presentationStyle = useMemo(
    () => (isMobile ? getSpectaPresentationStyle(storyData) : undefined),
    [isMobile, storyData],
  );

  const { scrollTrackLayout, bindScrollTrackElement } =
    useListStoryScrollTrackContext();

  useLayoutEffect(() => {
    bindScrollTrackElement(scrollContainerRef.current);

    return () => {
      bindScrollTrackElement(null);
    };
  }, [bindScrollTrackElement, scrollContainerRef, initialLayersReady]);

  useListStoryScroll({
    enabled: Boolean(onSegmentTransitionChange),
    scrollContainerRef,
    scrollerReady: initialLayersReady,
    storyData,
    scrollTrackLayout,
    items: segmentViewItems,
    currentIndex,
    setIndex,
    onSegmentTransitionChange,
  });

  if (!initialLayersReady) {
    return null;
  }

  return (
    <div
      ref={scrollContainerRef}
      id="jgis-story-segment-panel"
      className={
        isMobile
          ? 'jgis-story-mobile-list-scroll'
          : 'jgis-story-stage-scroll-host'
      }
      style={presentationStyle}
      aria-hidden={isMobile ? undefined : true}
      data-testid="jgis-story-stage-scroll-host"
    >
      <ListStoryVirtualScrollTrack scrollTrackLayout={scrollTrackLayout} />
    </div>
  );
}
