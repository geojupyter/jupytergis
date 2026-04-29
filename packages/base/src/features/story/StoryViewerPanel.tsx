import {
  IJGISStoryMap,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import React, { RefObject } from 'react';

import StoryContentSection from './components/StoryContentSection';
import StoryImageSection from './components/StoryImageSection';
import StoryNavBar from './components/StoryNavBar';
import StorySubtitleSection from './components/StorySubtitleSection';
import StoryTitleSection from './components/StoryTitleSection';
import { useStoryImagePreload } from './hooks/useStoryImagePreload';

/** Props: story state and callbacks come from useStoryMap in parent (SpectaPanel or SpectaMobileView). */
interface IStoryViewerPanelProps {
  isSpecta: boolean;
  isMobile?: boolean;
  /** Ref for the segment container (SpectaPanel uses it for animationend). */
  segmentContainerRef?: RefObject<HTMLDivElement>;
  storyData: IJGISStoryMap | null;
  currentIndex: number;
  activeSlide: IStorySegmentLayer['parameters'] | undefined;
  layerName: string;
  handlePrev: () => void;
  handleNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
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
  storyType: string,
  isMobile: boolean,
): StoryNavPlacement | null {
  if (isSpecta) {
    return isMobile ? null : 'subtitle-specta';
  }
  if (storyType !== 'guided') {
    return null;
  }
  return hasImage ? 'over-image' : 'below-title';
}

/**
 * Story viewer (presentational). Receives story state and callbacks from parent.
 * Desktop scroll/sentinel/imperative handle live in SpectaDesktopView.
 */
function StoryViewerPanel({
  isSpecta,
  isMobile = false,
  segmentContainerRef,
  storyData,
  currentIndex,
  activeSlide,
  layerName,
  handlePrev,
  handleNext,
  hasPrev,
  hasNext,
}: IStoryViewerPanelProps) {
  const imageLoaded = useStoryImagePreload(activeSlide?.content?.image);

  if (!storyData || storyData?.storySegments?.length === 0) {
    return (
      <div style={{ padding: '1rem' }}>
        <p>No Segments available. Add one using the Add Layer menu.</p>
      </div>
    );
  }

  const storyNavBarProps = {
    onPrev: handlePrev,
    onNext: handleNext,
    hasPrev,
    hasNext,
  };

  const hasImage = !!(activeSlide?.content?.image && imageLoaded);
  const storyType = storyData.storyType ?? 'guided';
  const navPlacement = getStoryNavPlacement(
    isSpecta,
    hasImage,
    storyType,
    isMobile,
  );

  const navSlot =
    navPlacement !== null ? (
      <StoryNavBar placement={navPlacement} {...storyNavBarProps} />
    ) : null;

  // Get transition time from current segment, default to 0.3s
  const transitionTime = activeSlide?.transition?.time ?? 0.3;

  return (
    <div className="jgis-story-viewer-panel">
      <div
        ref={segmentContainerRef}
        key={currentIndex}
        className="jgis-story-segment-container"
        style={{
          animationDuration: `${transitionTime}s`,
        }}
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
          <StoryContentSection
            markdown={activeSlide?.content?.markdown ?? ''}
          />
        </div>
      </div>
    </div>
  );
}

StoryViewerPanel.displayName = 'StoryViewerPanel';

export default StoryViewerPanel;
