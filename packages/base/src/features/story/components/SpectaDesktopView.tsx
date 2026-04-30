import {
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import React, { RefObject, useImperativeHandle } from 'react';

import { SpectaListModeContent } from '@/src/features/story/components/SpectaListModeContent';
import { SpectaSingleModeContent } from '@/src/features/story/components/SpectaSingleModeContent';
import { IStoryViewerPanelHandle } from '@/src/features/story/StoryViewerPanel';
import { useStoryScrollState } from '@/src/features/story/hooks/useStoryScrollState';
import { useStorySegmentViewItems } from '@/src/features/story/hooks/useStorySegmentViewItems';
import SpectaPresentationProgressBar from '@/src/workspace/statusbar/SpectaPresentationProgressBar';

export type StoryDesktopViewMode = 'single' | 'list';

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
  viewMode: StoryDesktopViewMode;
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
  viewMode,
  setIndex,
}: ISpectaDesktopViewProps): JSX.Element {
  const {
    scrollContainerRef,
    topSentinelRef,
    bottomSentinelRef,
    getAtTop,
    getAtBottom,
  } = useStoryScrollState({ currentIndex });

  const segmentViewItems = useStorySegmentViewItems({
    model,
    storyData,
    currentIndex,
  });
  const renderModeContent: Record<StoryDesktopViewMode, () => JSX.Element> = {
    single: () => (
      <SpectaSingleModeContent
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
        topSentinelRef={topSentinelRef}
        bottomSentinelRef={bottomSentinelRef}
      />
    ),
    list: () => (
      <SpectaListModeContent
        isSpecta={isSpecta}
        storyData={storyData}
        items={segmentViewItems}
        currentIndex={currentIndex}
        setIndex={setIndex}
        handlePrev={handlePrev}
        handleNext={handleNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />
    ),
  };

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
            className={`jgis-story-viewer-panel-specta-mod ${
              viewMode === 'list' ? 'jgis-story-viewer-panel-specta-mod-list' : ''
            }`}
            id="jgis-story-segment-panel"
            style={showGradient ? undefined : { width: 'unset' }}
          >
            {renderModeContent[viewMode]()}
          </div>
        </div>
      </div>
      <SpectaPresentationProgressBar model={model} />
    </>
  );
}
