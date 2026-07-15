import React, { useEffect, useMemo, useRef } from 'react';

import { useStoryMap } from '@/src/features/story/hooks/useStoryMap';
import { getStoryPresentationMode } from '@/src/features/story/presentation/getStoryPresentationMode';
import {
  StoryPresentationDesktopChrome,
  StoryPresentationMobileChrome,
} from '@/src/features/story/presentation/StoryPresentationChrome';
import type { IStoryPresentationRootProps } from '@/src/features/story/presentation/types';
import type { IOverrideLayerEntry } from '@/src/features/story/types/types';

/**
 * Single entry for story presentation chrome.
 * Resolves layout mode once and delegates to column / vertical-scroll shells.
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

  const chromeProps = {
    model,
    isSpecta,
    presentationMode,
    segmentContainerRef,
    storyData,
    currentIndex,
    setIndex,
    activeSlide,
    layerName,
    handlePrev,
    handleNext,
    hasPrev,
    hasNext,
    showGradient,
    onSegmentTransitionChange,
  };

  if (isMobile) {
    return <StoryPresentationMobileChrome {...chromeProps} />;
  }

  return (
    <StoryPresentationDesktopChrome
      {...chromeProps}
      containerRef={containerRef}
      storyViewerPanelRef={storyViewerPanelRef}
    />
  );
}
