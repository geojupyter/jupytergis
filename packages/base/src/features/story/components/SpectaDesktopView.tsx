import {
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import React, {
  RefObject,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
} from 'react';

import { IStoryViewerPanelHandle } from '@/src/features/story/StoryViewerPanel';
import { ListStoryVirtualScrollTrack } from '@/src/features/story/components/ListStoryVirtualScrollTrack';
import { SpectaSingleModeContent } from '@/src/features/story/components/SpectaSingleModeContent';
import { useListStoryScrollTrackContext } from '@/src/features/story/context/ListStoryScrollTrackContext';
import { useListStoryScroll } from '@/src/features/story/hooks/useListStoryScroll';
import { useStoryScrollState } from '@/src/features/story/hooks/useStoryScrollState';
import type { IListStorySegmentTransition } from '@/src/features/story/types/types';
import { isVerticalScrollPresentation } from '@/src/features/story/presentation/getStoryPresentationMode';
import type { StoryPresentationMode } from '@/src/features/story/presentation/types';
import { getSpectaPresentationCssVars } from '@/src/features/story/utils/spectaPresentation';
import { buildStorySegmentViewItems } from '@/src/features/story/utils/storySegmentViewItems';
import SpectaPresentationProgressBar from '@/src/workspace/statusbar/SpectaPresentationProgressBar';

type StoryDesktopViewMode = 'single' | 'verticalScroll';

interface ISpectaDesktopViewProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  presentationMode: StoryPresentationMode;
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
  onSegmentTransitionChange?: (
    payload: IListStorySegmentTransition | null,
  ) => void;
}

export function SpectaDesktopView({
  model,
  isSpecta,
  presentationMode,
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
  onSegmentTransitionChange,
}: ISpectaDesktopViewProps): JSX.Element {
  const isVerticalScrollView = isVerticalScrollPresentation(presentationMode);
  const viewMode: StoryDesktopViewMode = isVerticalScrollView
    ? 'verticalScroll'
    : 'single';
  const sentinelsEnabled = !isVerticalScrollView;
  const {
    scrollContainerRef,
    topSentinelRef,
    bottomSentinelRef,
    getAtTop,
    getAtBottom,
  } = useStoryScrollState({ currentIndex, sentinelsEnabled });

  const segmentViewItems = useMemo(
    () => buildStorySegmentViewItems(model, storyData),
    [model, storyData],
  );

  const spectaPresentationStyle = useMemo(
    () => getSpectaPresentationCssVars(storyData),
    [
      storyData?.storyType,
      storyData?.presentationBgColor,
      storyData?.presentationTextColor,
    ],
  );

  const segmentTransitionSyncEnabled =
    Boolean(onSegmentTransitionChange) && isVerticalScrollView;

  const { scrollTrackLayout, bindScrollTrackElement } =
    useListStoryScrollTrackContext();

  useLayoutEffect(() => {
    if (!isVerticalScrollView) {
      bindScrollTrackElement(null);
      return;
    }

    bindScrollTrackElement(scrollContainerRef.current);

    return () => {
      bindScrollTrackElement(null);
    };
  }, [isVerticalScrollView, bindScrollTrackElement, scrollContainerRef]);

  useListStoryScroll({
    enabled: segmentTransitionSyncEnabled,
    scrollContainerRef,
    storyData,
    scrollTrackLayout,
    items: segmentViewItems,
    currentIndex,
    setIndex,
    onSegmentTransitionChange,
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
    verticalScroll: () => (
      <ListStoryVirtualScrollTrack scrollTrackLayout={scrollTrackLayout} />
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
        className={`jgis-specta-right-panel-container-mod jgis-right-panel-container jgis-story-chrome--${presentationMode}`}
        style={showGradient ? undefined : { width: '25%', borderRadius: 0 }}
      >
        <div
          ref={containerRef}
          className="jgis-specta-story-panel-container"
          style={spectaPresentationStyle}
        >
          <div
            ref={scrollContainerRef}
            className={`jgis-story-viewer-panel-specta-mod ${
              isVerticalScrollView
                ? 'jgis-story-viewer-panel-specta-mod-vertical-scroll'
                : ''
            }`}
            id="jgis-story-segment-panel"
            style={showGradient ? undefined : { width: 'unset' }}
          >
            {renderModeContent[viewMode]()}
          </div>
        </div>
      </div>
      {!isVerticalScrollView && <SpectaPresentationProgressBar model={model} />}
    </>
  );
}
