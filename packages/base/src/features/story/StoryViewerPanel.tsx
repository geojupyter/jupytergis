import {
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import React, { RefObject } from 'react';

import {
  getStoryPresentationMode,
  isColumnPresentation,
  isVerticalScrollPresentation,
} from '@/src/features/story/presentation/getStoryPresentationMode';
import type { StoryPresentationMode } from '@/src/features/story/presentation/types';
import { RenderedStoryMarkdown } from './components/RenderedStoryMarkdown';
import StoryImageSection from './components/StoryImageSection';
import StoryNavBar from './components/StoryNavBar';
import StorySubtitleSection from './components/StorySubtitleSection';
import StoryTitleSection from './components/StoryTitleSection';
import { useStoryImagePreload } from './hooks/useStoryImagePreload';

export interface IStoryViewerPanelSegmentNav {
  handlePrev: () => void;
  handleNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

interface IStoryViewerPanelProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  isMobile?: boolean;
  segmentContainerRef?: RefObject<HTMLDivElement>;
  storyData: IJGISStoryMap | null;
  currentIndex: number;
  activeSlide: IStorySegmentLayer['parameters'] | undefined;
  layerName: string;
  /** Omit for list-story overlay; required when segment nav is shown. */
  segmentNav?: IStoryViewerPanelSegmentNav;
  /** Disable fade animation for list stories. */
  disableSegmentAnimation?: boolean;
}

export interface IStoryViewerPanelHandle {
  handlePrev: () => void;
  handleNext: () => void;
  spectaMode: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  getAtTop: () => boolean;
  getAtBottom: () => boolean;
  /** The scrollable panel DOM element (same instance for all segments). */
  getScrollContainer: () => HTMLDivElement | null;
}

/**
 * Where the story nav bar should be rendered in the viewer layout.
 * - below-title: normal mode, guided, no image (under the title)
 * - over-image: normal mode, guided, with image (over the image)
 * - subtitle-specta: specta mode desktop (next to subtitle, fixed centered)
 * Specta mode mobile returns null (nav hidden).
 */
export type StoryNavPlacement =
  | 'below-title'
  | 'over-image'
  | 'subtitle-specta';

/**
 * Returns which section should render the nav bar, or null if nav should be hidden.
 */
function getStoryNavPlacement(
  isSpecta: boolean,
  hasImage: boolean,
  presentationMode: StoryPresentationMode,
  isMobile: boolean,
): StoryNavPlacement | null {
  if (isVerticalScrollPresentation(presentationMode)) {
    return null;
  }

  if (isSpecta) {
    return isMobile ? null : 'subtitle-specta';
  }

  return hasImage ? 'over-image' : 'below-title';
}

/**
 * Story viewer (presentational). Receives story state and callbacks from parent.
 * Desktop scroll/sentinel/imperative handle live in SpectaDesktopView.
 */
function StoryViewerPanel({
  model,
  isSpecta,
  isMobile = false,
  segmentContainerRef,
  storyData,
  currentIndex,
  activeSlide,
  layerName,
  segmentNav,
  disableSegmentAnimation = false,
}: IStoryViewerPanelProps) {
  const imageLoaded = useStoryImagePreload(activeSlide?.content?.image);

  if (!storyData || storyData?.storySegments?.length === 0) {
    return (
      <div style={{ padding: '1rem' }}>
        <p>No Segments available. Add one using the Add Layer menu.</p>
      </div>
    );
  }

  const segmentId = storyData.storySegments?.[currentIndex] ?? '';
  const hasImage = !!(activeSlide?.content?.image && imageLoaded);
  const presentationMode = getStoryPresentationMode(storyData.storyType);
  const navPlacement = getStoryNavPlacement(
    isSpecta,
    hasImage,
    presentationMode,
    isMobile,
  );

  const navSlot =
    navPlacement !== null && segmentNav ? (
      <StoryNavBar
        placement={navPlacement}
        onPrev={segmentNav.handlePrev}
        onNext={segmentNav.handleNext}
        hasPrev={segmentNav.hasPrev}
        hasNext={segmentNav.hasNext}
      />
    ) : null;

  const transitionTime = activeSlide?.transition?.time ?? 0.3;
  const segmentAnimationEnabled = !disableSegmentAnimation;
  const segmentContainerKey = segmentAnimationEnabled
    ? currentIndex
    : undefined;
  const segmentContainerClassName = segmentAnimationEnabled
    ? 'jgis-story-segment-container'
    : 'jgis-story-segment-container jgis-story-segment-container--no-segment-animation';
  const segmentContainerStyle = segmentAnimationEnabled
    ? { animationDuration: `${transitionTime}s` }
    : undefined;

  return (
    <div
      className={
        isColumnPresentation(presentationMode) ? 'jgis-story-viewer-panel' : ''
      }
    >
      <div
        ref={segmentContainerRef}
        key={segmentContainerKey}
        className={segmentContainerClassName}
        style={segmentContainerStyle}
      >
        <div id="jgis-story-segment-header">
          <h1 className="jgis-story-viewer-title">
            {layerName ?? `Slide ${currentIndex + 1}`}
          </h1>
          {activeSlide?.content?.image && imageLoaded ? (
            <StoryImageSection
              imageUrl={activeSlide.content.image}
              imageLoaded={imageLoaded}
              layerName={layerName ?? ''}
              slideNumber={currentIndex}
              navSlot={navPlacement === 'over-image' ? navSlot : null}
            />
          ) : (
            <StoryTitleSection
              title={storyData.title ?? ''}
              navSlot={navPlacement === 'below-title' ? navSlot : null}
            />
          )}
          <StorySubtitleSection
            title={activeSlide?.content?.title ?? ''}
            navSlot={navPlacement === 'subtitle-specta' ? navSlot : null}
          />
        </div>
        <div id="jgis-story-segment-content">
          <RenderedStoryMarkdown
            model={model}
            segmentId={segmentId}
            source={activeSlide?.content?.markdown ?? ''}
            variant="column"
          />
        </div>
      </div>
    </div>
  );
}

export default StoryViewerPanel;
