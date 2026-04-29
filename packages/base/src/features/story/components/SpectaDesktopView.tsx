import {
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import React, { RefObject, useImperativeHandle } from 'react';

import StoryViewerPanel, {
  IStoryViewerPanelHandle,
} from '@/src/features/story/StoryViewerPanel';
import { SpectaSegmentListPanel } from '@/src/features/story/components/SpectaSegmentListPanel';
import { useStoryScrollState } from '@/src/features/story/hooks/useStoryScrollState';
import SpectaPresentationProgressBar from '@/src/workspace/statusbar/SpectaPresentationProgressBar';

interface ISpectaDesktopViewProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  containerRef: RefObject<HTMLDivElement>;
  storyViewerPanelRef: RefObject<IStoryViewerPanelHandle>;
  segmentContainerRef: RefObject<HTMLDivElement>;
  storyData: IJGISStoryMap | null;
  currentIndex: number;
  activeSlide: IStorySegmentLayer['parameters'] | undefined;
  layerName: string;
  handlePrev: () => void;
  handleNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  showGradient: boolean;
  setIndex: (index: number) => void;
}

export function SpectaDesktopView({
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
  showGradient,
  setIndex,
}: ISpectaDesktopViewProps): JSX.Element {
  const {
    scrollContainerRef,
    topSentinelRef,
    bottomSentinelRef,
    getAtTop,
    getAtBottom,
  } = useStoryScrollState({ currentIndex });

  useImperativeHandle(
    storyViewerPanelRef,
    () => ({
      handlePrev,
      handleNext,
      spectaMode: isSpecta,
      hasPrev,
      hasNext,
      getAtTop,
      getAtBottom,
      getScrollContainer: () => scrollContainerRef.current,
    }),
    [handlePrev, handleNext, isSpecta, hasPrev, hasNext, getAtTop, getAtBottom],
  );

  return (
    <>
      <div
        className="jgis-specta-right-panel-container-mod jgis-right-panel-container"
        style={showGradient ? undefined : { width: '25%', borderRadius: 0 }}
      >
        <div ref={containerRef} className="jgis-specta-story-panel-container">
          <div
            ref={scrollContainerRef}
            className="jgis-story-viewer-panel-specta-mod"
            id="jgis-story-segment-panel"
            style={showGradient ? undefined : { width: 'unset' }}
          >
            <div
              ref={topSentinelRef}
              aria-hidden
              data-story-scroll-sentinel="top"
              style={{ height: 1, minHeight: 1, pointerEvents: 'none' }}
            />
            {/* <SpectaSegmentListPanel
              model={model}
              isSpecta={isSpecta}
              storyData={storyData}
              currentIndex={currentIndex}
              handlePrev={handlePrev}
              handleNext={handleNext}
              hasPrev={hasPrev}
              hasNext={hasNext}
              setIndex={setIndex}
            /> */}
            <StoryViewerPanel
              model={model}
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
