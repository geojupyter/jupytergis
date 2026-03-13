import {
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import React, { RefObject, useEffect, useState } from 'react';

import StoryContentSection from './components/StoryContentSection';
import StoryImageSection from './components/StoryImageSection';
import StoryNavBar from './components/StoryNavBar';
import StorySubtitleSection from './components/StorySubtitleSection';
import StoryTitleSection from './components/StoryTitleSection';

/** Props: story state and callbacks come from useStoryMap in parent (SpectaPanel or SpectaMobileView). */
interface IStoryViewerPanelProps {
  model: IJupyterGISModel;
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
  setIndex: (index: number) => void;
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
  model,
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
  setIndex,
}: IStoryViewerPanelProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Prefetch image when slide changes
  useEffect(() => {
    const imageUrl = activeSlide?.content?.image;

    if (!imageUrl) {
      setImageLoaded(false);
      return;
    }

    // Reset state
    setImageLoaded(false);

    // Preload the image
    const img = new Image();

    img.onload = () => {
      setImageLoaded(true);
    };

    img.onerror = () => {
      setImageLoaded(false);
    };

    img.src = imageUrl;

    // Cleanup: abort loading if component unmounts or slide changes
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [activeSlide?.content?.image]);

  // ! TODO come back for this
  // Listen for layer selection changes in unguided mode
  useEffect(() => {
    // ! TODO this logic (getting a single selected layer) is also in the processing index.ts, move to tools
    const handleSelectedStorySegmentChange = () => {
      // This is just to update the displayed content
      // So bail early if we don't need to do that
      if (!storyData || storyData.storyType !== 'unguided') {
        return;
      }

      const localState = model.sharedModel.awareness.getLocalState();
      if (!localState || !localState['selected']?.value) {
        return;
      }

      const selectedLayers = Object.keys(localState['selected'].value);

      // Ensure only one layer is selected
      if (selectedLayers.length !== 1) {
        return;
      }

      const selectedLayerId = selectedLayers[0];
      const selectedLayer = model.getLayer(selectedLayerId);
      if (!selectedLayer || selectedLayer.type !== 'StorySegmentLayer') {
        return;
      }

      const index = storyData.storySegments?.indexOf(selectedLayerId);
      if (index === undefined || index === -1) {
        return;
      }

      setIndex(index);
    };

    // ! TODO really only want to connect this un unguided mode
    model.sharedModel.awareness.on('change', handleSelectedStorySegmentChange);

    return () => {
      model.sharedModel.awareness.off(
        'change',
        handleSelectedStorySegmentChange,
      );
    };
  }, [model, storyData, setIndex]);

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
