import {
  IJGISLayer,
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import React, { useEffect, useImperativeHandle, useRef } from 'react';

import { cn } from '@/src/shared/components/utils';
import { MobileSpectaPanel } from './MobileSpectaPanel';
import StoryViewerPanel, { IStoryViewerPanelHandle } from './StoryViewerPanel';
import { useStoryMap, type IOverrideLayerEntry } from './useStoryMap';
import SpectaPresentationProgressBar from '../../statusbar/SpectaPresentationProgressBar';

export interface ISpectaPanelDesktopProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  storyViewerPanelRef: React.RefObject<IStoryViewerPanelHandle>;
  segmentContainerRef: React.RefObject<HTMLDivElement>;
  storyData: IJGISStoryMap | null;
  currentIndex: number;
  activeSlide: IStorySegmentLayer['parameters'] | undefined;
  layerName: string;
  handlePrev: () => void;
  handleNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  setIndex: (index: number) => void;
}

function SpectaPanelDesktop({
  model,
  isSpecta,
  containerRef,
  storyViewerPanelRef,
  segmentContainerRef,
  storyData,
  currentIndex,
  activeSlide,
  layerName,
  handlePrev,
  handleNext,
  hasPrev,
  hasNext,
  setIndex,
}: ISpectaPanelDesktopProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const atTopRef = useRef(false);
  const atBottomRef = useRef(false);

  useEffect(() => {
    const root = scrollContainerRef.current;
    const topEl = topSentinelRef.current;
    const bottomEl = bottomSentinelRef.current;
    if (!root || !topEl || !bottomEl) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        for (const entry of entries) {
          if (entry.target === topEl) {
            atTopRef.current = entry.isIntersecting;
          } else if (entry.target === bottomEl) {
            atBottomRef.current = entry.isIntersecting;
          }
        }
      },
      { root, threshold: 0, rootMargin: '0px' },
    );
    observer.observe(topEl);
    observer.observe(bottomEl);
    return () => observer.disconnect();
  }, [currentIndex]);

  useImperativeHandle(
    storyViewerPanelRef,
    () => ({
      handlePrev,
      handleNext,
      spectaMode: isSpecta,
      hasPrev,
      hasNext,
      getAtTop: () => atTopRef.current,
      getAtBottom: () => atBottomRef.current,
      getScrollContainer: () => scrollContainerRef.current,
    }),
    [handlePrev, handleNext, isSpecta, hasPrev, hasNext],
  );

  return (
    <>
      <div className="jgis-specta-right-panel-container-mod jgis-right-panel-container">
        <div ref={containerRef} className="jgis-specta-story-panel-container">
          <div
            ref={scrollContainerRef}
            className={cn(
              'jgis-story-viewer-panel',
              'jgis-story-viewer-panel-specta-mod',
            )}
            id="jgis-story-segment-panel"
          >
            <div
              ref={topSentinelRef}
              aria-hidden
              data-story-scroll-sentinel="top"
              style={{ height: 1, minHeight: 1, pointerEvents: 'none' }}
            />
            <StoryViewerPanel
              model={model}
              isSpecta={isSpecta}
              className="jgis-story-viewer-panel-specta-mod"
              segmentContainerRef={segmentContainerRef}
              storyData={storyData}
              currentIndex={currentIndex}
              activeSlide={activeSlide}
              layerName={layerName}
              handlePrev={handlePrev}
              handleNext={handleNext}
              hasPrev={hasPrev}
              hasNext={hasNext}
              setIndex={setIndex}
            />
            <div
              ref={bottomSentinelRef}
              aria-hidden
              data-story-scroll-sentinel="bottom"
              style={{ height: 1, minHeight: 1, pointerEvents: 'none' }}
            />
          </div>
        </div>
      </div>
      <SpectaPresentationProgressBar model={model} />
    </>
  );
}

export interface ISpectaPanelProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  isMobile: boolean;
  onSegmentTransitionEnd: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
  storyViewerPanelRef: React.RefObject<IStoryViewerPanelHandle>;
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
  } = useStoryMap({
    model,
    overrideLayerEntriesRef,
    removeLayer,
    addLayer,
    panelRef: isMobile ? undefined : containerRef,
    isSpecta,
  });

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
      <MobileSpectaPanel
        model={model}
        segmentContainerRef={segmentContainerRef}
        storyData={storyData}
        currentIndex={currentIndex}
        activeSlide={activeSlide}
        layerName={layerName}
        handlePrev={handlePrev}
        handleNext={handleNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
        setIndex={setIndex}
      />
    );
  }

  return (
    <SpectaPanelDesktop
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
      setIndex={setIndex}
    />
  );
}
