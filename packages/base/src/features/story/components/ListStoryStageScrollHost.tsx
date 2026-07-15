import type { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import React, { type RefObject, useLayoutEffect, useMemo, useRef } from 'react';

import { ListStoryVirtualScrollTrack } from '@/src/features/story/components/ListStoryVirtualScrollTrack';
import { useListStoryScrollTrackContext } from '@/src/features/story/context/ListStoryScrollTrackContext';
import { useListStoryScroll } from '@/src/features/story/hooks/useListStoryScroll';
import { useStoryMap } from '@/src/features/story/hooks/useStoryMap';
import type {
  IOverrideLayerEntry,
  IListStorySegmentTransition,
} from '@/src/features/story/types/types';
import { buildStorySegmentViewItems } from '@/src/features/story/utils/storySegmentViewItems';

interface IListStoryStageScrollHostProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  initialLayersReady: boolean;
  scrollContainerRef: RefObject<HTMLDivElement>;
  addLayer: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer: (id: string) => void;
  onSegmentTransitionChange: (
    payload: IListStorySegmentTransition | null,
  ) => void;
}

/**
 * Desktop vertical-scroll scrollport on the map stage.
 */
export function ListStoryStageScrollHost({
  model,
  isSpecta,
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
      className="jgis-story-stage-scroll-host"
      aria-hidden
      data-testid="jgis-story-stage-scroll-host"
    >
      <ListStoryVirtualScrollTrack scrollTrackLayout={scrollTrackLayout} />
    </div>
  );
}
