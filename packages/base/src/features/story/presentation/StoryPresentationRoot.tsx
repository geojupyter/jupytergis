import React, { useEffect, useMemo, useRef } from 'react';

import type { IStoryViewerPanelHandle } from '@/src/features/story/StoryViewerPanel';
import { SpectaDesktopView } from '@/src/features/story/components/SpectaDesktopView';
import { SpectaMobileView } from '@/src/features/story/components/SpectaMobileView';
import { useStoryMap } from '@/src/features/story/hooks/useStoryMap';
import { getStoryPresentationMode } from '@/src/features/story/presentation/getStoryPresentationMode';
import type { IStoryPresentationRootProps } from '@/src/features/story/presentation/types';
import type {
  IOverrideLayerEntry,
  IListStorySegmentTransition,
} from '@/src/features/story/types/types';

/**
 * Single entry for story presentation chrome.
 * Resolves layout mode once and passes it to desktop/mobile shells.
 */
export function StoryPresentationRoot({
  model,
  isSpecta,
  isMobile,
  onSegmentTransitionEnd,
  containerRef,
  storyViewerPanelRef,
  addLayer,
  removeLayer,
  onSegmentTransitionChange,
}: IStoryPresentationRootProps): JSX.Element {
  const overrideLayerEntriesRef = useRef<IOverrideLayerEntry[]>([]);
  const segmentContainerRef = useRef<HTMLDivElement>(null);
  const {
    storyData,
    currentIndex,
    setIndex,
    handlePrev,
    handleNext,
    hasPrev,
    hasNext,
    activeSlide,
    layerName,
    showGradient,
  } = useStoryMap({
    model,
    overrideLayerEntriesRef,
    removeLayer,
    addLayer,
    isSpecta,
  });

  const presentationMode = useMemo(
    () => getStoryPresentationMode(storyData?.storyType),
    [storyData?.storyType],
  );

  useEffect(() => {
    const el = segmentContainerRef.current;
    if (!el || !onSegmentTransitionEnd) {
      return;
    }

    const handleAnimationEnd = (e: AnimationEvent) => {
      if (e.animationName === 'fadeIn') {
        el.removeEventListener('animationend', handleAnimationEnd);
        onSegmentTransitionEnd();
      }
    };
    el.addEventListener('animationend', handleAnimationEnd);

    return () => el.removeEventListener('animationend', handleAnimationEnd);
  }, [currentIndex, onSegmentTransitionEnd]);

  if (isMobile) {
    return (
      <SpectaMobileView
        model={model}
        presentationMode={presentationMode}
        segmentContainerRef={segmentContainerRef}
        storyData={storyData}
        currentIndex={currentIndex}
        setIndex={setIndex}
        activeSlide={activeSlide}
        layerName={layerName}
        handlePrev={handlePrev}
        handleNext={handleNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onSegmentTransitionChange={onSegmentTransitionChange}
      />
    );
  }

  return (
    <SpectaDesktopView
      model={model}
      isSpecta={isSpecta}
      presentationMode={presentationMode}
      containerRef={containerRef}
      storyViewerPanelRef={storyViewerPanelRef}
      segmentContainerRef={segmentContainerRef}
      storyData={storyData}
      currentIndex={currentIndex}
      activeSlide={activeSlide}
      layerName={layerName}
      handlePrev={handlePrev}
      handleNext={handleNext}
      hasPrev={hasPrev}
      hasNext={hasNext}
      showGradient={showGradient}
      setIndex={setIndex}
      onSegmentTransitionChange={onSegmentTransitionChange}
    />
  );
}
