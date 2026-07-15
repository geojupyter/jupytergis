import React, {
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
} from 'react';
import { ListStoryVirtualScrollTrack } from '@/src/features/story/components/ListStoryVirtualScrollTrack';
import { useListStoryScrollTrackContext } from '@/src/features/story/context/ListStoryScrollTrackContext';
import { useListStoryScroll } from '@/src/features/story/hooks/useListStoryScroll';
import { useStoryScrollState } from '@/src/features/story/hooks/useStoryScrollState';
import type { IStoryPresentationDesktopChromeProps } from '@/src/features/story/presentation/sharedChromeProps';
import { getSpectaPresentationCssVars } from '@/src/features/story/utils/spectaPresentation';
import { buildStorySegmentViewItems } from '@/src/features/story/utils/storySegmentViewItems';

/**
 * Vertical-scroll chrome on desktop: virtual scroll track in the side panel.
 */
export function VerticalScrollPresentationDesktop({
  model,
  isSpecta,
  presentationMode,
  containerRef,
  storyViewerPanelRef,
  storyData,
  currentIndex,
  setIndex,
  handlePrev,
  handleNext,
  hasPrev,
  hasNext,
  showGradient,
  onSegmentTransitionChange,
}: IStoryPresentationDesktopChromeProps): JSX.Element {
  const {
    scrollContainerRef,
    getAtTop,
    getAtBottom,
  } = useStoryScrollState({ currentIndex, sentinelsEnabled: false });

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

  const { scrollTrackLayout, bindScrollTrackElement } =
    useListStoryScrollTrackContext();

  useLayoutEffect(() => {
    bindScrollTrackElement(scrollContainerRef.current);

    return () => {
      bindScrollTrackElement(null);
    };
  }, [bindScrollTrackElement, scrollContainerRef]);

  useListStoryScroll({
    enabled: Boolean(onSegmentTransitionChange),
    scrollContainerRef,
    storyData,
    scrollTrackLayout,
    items: segmentViewItems,
    currentIndex,
    setIndex,
    onSegmentTransitionChange,
  });

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
    [
      handlePrev,
      handleNext,
      isSpecta,
      hasPrev,
      hasNext,
      getAtTop,
      getAtBottom,
    ],
  );

  return (
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
          className="jgis-story-viewer-panel-specta-mod jgis-story-viewer-panel-specta-mod-vertical-scroll"
          id="jgis-story-segment-panel"
          style={showGradient ? undefined : { width: 'unset' }}
        >
          <ListStoryVirtualScrollTrack scrollTrackLayout={scrollTrackLayout} />
        </div>
      </div>
    </div>
  );
}
