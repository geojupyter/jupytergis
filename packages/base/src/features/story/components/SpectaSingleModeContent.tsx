import { IJGISStoryMap, IStorySegmentLayer } from '@jupytergis/schema';
import React, { RefObject } from 'react';

import StoryViewerPanel from '@/src/features/story/StoryViewerPanel';

interface ISpectaSingleModeContentProps {
  isSpecta: boolean;
  segmentContainerRef: RefObject<HTMLDivElement>;
  storyData: IJGISStoryMap | null;
  currentIndex: number;
  activeSlide: IStorySegmentLayer['parameters'] | undefined;
  layerName: string;
  handlePrev: () => void;
  handleNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  topSentinelRef: RefObject<HTMLDivElement>;
  bottomSentinelRef: RefObject<HTMLDivElement>;
}

export function SpectaSingleModeContent({
  isSpecta,
  segmentContainerRef,
  storyData,
  currentIndex,
  activeSlide,
  layerName,
  handlePrev,
  handleNext,
  hasPrev,
  hasNext,
  topSentinelRef,
  bottomSentinelRef,
}: ISpectaSingleModeContentProps): JSX.Element {
  return (
    <>
      <div
        ref={topSentinelRef}
        aria-hidden
        data-story-scroll-sentinel="top"
        style={{ height: 1, minHeight: 1, pointerEvents: 'none' }}
      />
      <StoryViewerPanel
        isSpecta={isSpecta}
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
      <div
        ref={bottomSentinelRef}
        aria-hidden
        data-story-scroll-sentinel="bottom"
        style={{ height: 1, minHeight: 1, pointerEvents: 'none' }}
      />
    </>
  );
}
