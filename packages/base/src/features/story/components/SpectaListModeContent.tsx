import { IJGISStoryMap } from '@jupytergis/schema';
import React, { RefObject } from 'react';

import { SpectaSegmentListPanel } from '@/src/features/story/components/SpectaSegmentListPanel';
import { IStorySegmentViewItem } from '@/src/features/story/hooks/useStorySegmentViewItems';

/**
 * List-mode Specta body: stacked segment cards inside the story scroller.
 * Scroll position is read by useListStoryScroll (parent) for active index
 * and overlay drive; this layer only forwards the scroll root ref.
 */
interface ISpectaListModeContentProps {
  isSpecta: boolean;
  storyData: IJGISStoryMap | null;
  items: IStorySegmentViewItem[];
  handlePrev: () => void;
  handleNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  listIntersectionRootRef: RefObject<HTMLDivElement | null>;
}

export function SpectaListModeContent({
  isSpecta,
  storyData,
  items,
  handlePrev,
  handleNext,
  hasPrev,
  hasNext,
  listIntersectionRootRef,
}: ISpectaListModeContentProps): JSX.Element {
  return (
    <SpectaSegmentListPanel
      isSpecta={isSpecta}
      storyData={storyData}
      items={items}
      handlePrev={handlePrev}
      handleNext={handleNext}
      hasPrev={hasPrev}
      hasNext={hasNext}
      listIntersectionRootRef={listIntersectionRootRef}
    />
  );
}
