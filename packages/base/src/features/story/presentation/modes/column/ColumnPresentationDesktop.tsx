import React, { useImperativeHandle, useMemo } from 'react';

import { SpectaSingleModeContent } from '@/src/features/story/components/SpectaSingleModeContent';
import { useStoryScrollState } from '@/src/features/story/hooks/useStoryScrollState';
import type { IStoryPresentationDesktopChromeProps } from '@/src/features/story/presentation/sharedChromeProps';
import { getSpectaPresentationCssVars } from '@/src/features/story/utils/spectaPresentation';
import SpectaPresentationProgressBar from '@/src/workspace/statusbar/SpectaPresentationProgressBar';

/**
 * Guided column chrome: side panel with segment nav and scroll sentinels.
 */
export function ColumnPresentationDesktop({
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
}: IStoryPresentationDesktopChromeProps): JSX.Element {
  const {
    scrollContainerRef,
    topSentinelRef,
    bottomSentinelRef,
    getAtTop,
    getAtBottom,
  } = useStoryScrollState({ currentIndex, sentinelsEnabled: true });

  const spectaPresentationStyle = useMemo(
    () => getSpectaPresentationCssVars(storyData),
    [
      storyData?.storyType,
      storyData?.presentationBgColor,
      storyData?.presentationTextColor,
    ],
  );

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
            className="jgis-story-viewer-panel-specta-mod"
            id="jgis-story-segment-panel"
            style={showGradient ? undefined : { width: 'unset' }}
          >
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
          </div>
        </div>
      </div>
      <SpectaPresentationProgressBar model={model} />
    </>
  );
}
