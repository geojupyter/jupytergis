import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import React, { RefObject, useEffect, useRef } from 'react';

import type { IStoryViewerPanelHandle } from './StoryViewerPanel';
import { SpectaDesktopView } from './components/SpectaDesktopView';
import { SpectaMobileView } from './components/SpectaMobileView';
import { useStoryMap, type IOverrideLayerEntry } from './hooks/useStoryMap';
import { useStorySegmentSync } from './hooks/useStorySegmentSync';

interface ISpectaPanelProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  isMobile: boolean;
  onSegmentTransitionEnd: () => void;
  containerRef: RefObject<HTMLDivElement>;
  storyViewerPanelRef: RefObject<IStoryViewerPanelHandle>;
  addLayer?: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer?: (id: string) => void;
}

export function SpectaPanel({
  model,
  isSpecta,
  isMobile,
  onSegmentTransitionEnd,
  containerRef,
  storyViewerPanelRef,
  addLayer,
  removeLayer,
}: ISpectaPanelProps) {
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
    panelRef: isMobile ? undefined : containerRef,
    isSpecta,
  });

  useStorySegmentSync({ model, storyData, setIndex });

  const desktopViewMode =
    storyData?.storyType === 'guided' || storyData?.storyType === 'unguided'
      ? 'single'
      : 'list';

  // Notify when segment transition animation ends
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
        segmentContainerRef={segmentContainerRef}
        storyData={storyData}
        currentIndex={currentIndex}
        activeSlide={activeSlide}
        layerName={layerName}
        handlePrev={handlePrev}
        handleNext={handleNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />
    );
  }

  return (
    <SpectaDesktopView
      model={model}
      isSpecta={isSpecta}
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
      viewMode={desktopViewMode}
      setIndex={setIndex}
    />
  );
}
