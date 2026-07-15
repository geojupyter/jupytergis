import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import React, { RefObject, useEffect, useMemo, useRef } from 'react';

import { useStoryMap } from '@/src/features/story/hooks/useStoryMap';
import { getStoryPresentationMode } from '@/src/features/story/presentation/getStoryPresentationMode';
import {
  StoryPresentationDesktopChrome,
  StoryPresentationMobileChrome,
} from '@/src/features/story/presentation/StoryPresentationChrome';
import type { IStoryViewerPanelHandle } from '@/src/features/story/StoryViewerPanel';
import type {
  IOverrideLayerEntry,
  IListStorySegmentTransition,
} from '@/src/features/story/types/types';

export interface IMainViewSpectaPanelProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  isMobile: boolean;
  initialLayersReady: boolean;
  containerRef: RefObject<HTMLDivElement>;
  storyViewerPanelRef: RefObject<IStoryViewerPanelHandle>;
  addLayer: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer: (id: string) => void;
  onSegmentTransitionEnd: () => void;
  onSegmentTransitionChange: (
    payload: IListStorySegmentTransition | null,
  ) => void;
}

export function MainViewSpectaPanel({
  model,
  isSpecta,
  isMobile,
  initialLayersReady,
  containerRef,
  storyViewerPanelRef,
  addLayer,
  removeLayer,
  onSegmentTransitionEnd,
  onSegmentTransitionChange,
}: IMainViewSpectaPanelProps): JSX.Element | null {
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

  if (!initialLayersReady) {
    return null;
  }

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
