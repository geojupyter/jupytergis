import React from 'react';

import { SpectaMobileSingleModeContent } from '@/src/features/story/components/SpectaMobileSingleModeContent';
import type { IStoryPresentationMobileChromeProps } from '@/src/features/story/presentation/sharedChromeProps';

/**
 * Guided column chrome on mobile: bottom drawer with segment content.
 */
export function ColumnPresentationMobile({
  segmentContainerRef,
  storyData,
  currentIndex,
  activeSlide,
  layerName,
  handlePrev,
  handleNext,
  hasPrev,
  hasNext,
}: IStoryPresentationMobileChromeProps): JSX.Element {
  return (
    <SpectaMobileSingleModeContent
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
  );
}
