import type { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import React, { type RefObject, useEffect, useRef } from 'react';

import type { IStoryViewerPanelHandle } from '@/src/features/story/StoryViewerPanel';
import { useStoryMap } from '@/src/features/story/hooks/useStoryMap';
import { ColumnPresentationDesktop } from '@/src/features/story/presentation/modes/column/ColumnPresentationDesktop';
import { ColumnPresentationMobile } from '@/src/features/story/presentation/modes/column/ColumnPresentationMobile';
import type { IOverrideLayerEntry } from '@/src/features/story/types/types';

export interface IColumnStoryPanelProps {
  model: IJupyterGISModel;
  isMobile: boolean;
  initialLayersReady: boolean;
  containerRef: RefObject<HTMLDivElement>;
  storyViewerPanelRef: RefObject<IStoryViewerPanelHandle>;
  addLayer: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer: (id: string) => void;
  onSegmentTransitionEnd: () => void;
}

export function ColumnStoryPanel({
  model,
  isMobile,
  initialLayersReady,
  containerRef,
  storyViewerPanelRef,
  addLayer,
  removeLayer,
  onSegmentTransitionEnd,
}: IColumnStoryPanelProps): JSX.Element | null {
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
    isSpecta: true,
  });

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

  const props = {
    model,
    isSpecta: true,
    presentationMode: 'column' as const,
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
  };

  if (isMobile) {
    return <ColumnPresentationMobile {...props} />;
  }

  return (
    <ColumnPresentationDesktop
      {...props}
      containerRef={containerRef}
      storyViewerPanelRef={storyViewerPanelRef}
    />
  );
}
