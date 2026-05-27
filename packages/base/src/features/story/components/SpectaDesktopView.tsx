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
import { SpectaListModeContent } from '@/src/features/story/components/SpectaListModeContent';
import { SpectaSingleModeContent } from '@/src/features/story/components/SpectaSingleModeContent';
import { useListStoryLayoutContext } from '@/src/features/story/context/ListStoryLayoutContext';
import { useListStoryScroll } from '@/src/features/story/hooks/useListStoryScroll';
import { useStoryScrollState } from '@/src/features/story/hooks/useStoryScrollState';
import { buildStorySegmentViewItems } from '@/src/features/story/utils/storySegmentViewItems';
import type { IListStoryScrollDrivePayload } from '@/src/features/story/types/types';
import { getSpectaPresentationCssVars } from '@/src/features/story/utils/spectaPresentation';
import SpectaPresentationProgressBar from '@/src/workspace/statusbar/SpectaPresentationProgressBar';

type StoryDesktopViewMode = 'single' | 'list';

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
  onListScrollDriveChange?: (
    payload: IListStoryScrollDrivePayload | null,
  ) => void;
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
  onListScrollDriveChange,
}: ISpectaDesktopViewProps): JSX.Element {
  const viewMode =
    storyData?.storyType === 'guided' || storyData?.storyType === 'unguided'
      ? 'single'
      : 'list';

  const sentinelsEnabled = viewMode === 'single';
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

  const presentationStyle = useMemo(
    () => getSpectaPresentationCssVars(storyData),
    [
      storyData?.storyType,
      storyData?.presentationBgColor,
      storyData?.presentationTextColor,
    ],
  );

  const listScrollDriveEnabled =
    Boolean(onListScrollDriveChange) &&
    viewMode === 'list' &&
    storyData?.storyType === 'list';

  const { layout: listStoryLayout, bindScrollContainer } =
    useListStoryLayoutContext();

  useLayoutEffect(() => {
    if (viewMode !== 'list') {
      bindScrollContainer(null);
      return;
    }
    bindScrollContainer(scrollContainerRef.current);
    return () => {
      bindScrollContainer(null);
    };
  }, [viewMode, bindScrollContainer, scrollContainerRef]);

  useListStoryScroll({
    enabled: listScrollDriveEnabled,
    scrollContainerRef,
    storyData,
    layout: listStoryLayout,
    items: segmentViewItems,
    currentIndex,
    setIndex,
    onDriveChange: onListScrollDriveChange ?? (() => {}),
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
    list: () => <SpectaListModeContent layout={listStoryLayout} />,
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
        <div
          ref={containerRef}
          className="jgis-specta-story-panel-container"
          style={presentationStyle}
        >
          <div
            ref={scrollContainerRef}
            className={`jgis-story-viewer-panel-specta-mod ${
              viewMode === 'list'
                ? 'jgis-story-viewer-panel-specta-mod-list'
                : ''
            }`}
            id="jgis-story-segment-panel"
            style={showGradient ? undefined : { width: 'unset' }}
          >
            {renderModeContent[viewMode]()}
          </div>
        </div>
      </div>
      {viewMode !== 'list' && <SpectaPresentationProgressBar model={model} />}
    </>
  );
}
