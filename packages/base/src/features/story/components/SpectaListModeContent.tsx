import { IJGISStoryMap } from '@jupytergis/schema';
import React from 'react';

import { SpectaSegmentListPanel } from '@/src/features/story/components/SpectaSegmentListPanel';
import { IStorySegmentViewItem } from '@/src/features/story/hooks/useStorySegmentViewItems';

interface ISpectaListModeContentProps {
  isSpecta: boolean;
  storyData: IJGISStoryMap | null;
  items: IStorySegmentViewItem[];
  currentIndex: number;
  setIndex: (index: number) => void;
  handlePrev: () => void;
  handleNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function SpectaListModeContent({
  isSpecta,
  storyData,
  items,
  currentIndex,
  setIndex,
  handlePrev,
  handleNext,
  hasPrev,
  hasNext,
}: ISpectaListModeContentProps): JSX.Element {
  return (
    <SpectaSegmentListPanel
      isSpecta={isSpecta}
      storyData={storyData}
      items={items}
      currentIndex={currentIndex}
      setIndex={setIndex}
      handlePrev={handlePrev}
      handleNext={handleNext}
      hasPrev={hasPrev}
      hasNext={hasNext}
    />
  );
}
