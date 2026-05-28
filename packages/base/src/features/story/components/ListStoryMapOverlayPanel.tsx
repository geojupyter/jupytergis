import { IJGISStoryMap } from '@jupytergis/schema';
import React from 'react';

import StoryViewerPanel from '@/src/features/story/StoryViewerPanel';
import type { IStorySegmentViewItem } from '@/src/features/story/types/types';

interface IListStoryMapOverlayPanelProps {
  storyData: IJGISStoryMap;
  segmentIndex: number;
  items: IStorySegmentViewItem[];
}

/** Map segment chrome on the list-story stage overlay (not in the scroll column). */
export function ListStoryMapOverlayPanel({
  storyData,
  segmentIndex,
  items,
}: IListStoryMapOverlayPanelProps): JSX.Element | null {
  const item = items.find(entry => entry.index === segmentIndex);
  if (!item) {
    return null;
  }

  return (
    <div className="jgis-story-map-overlay-content">
      <StoryViewerPanel
        isSpecta
        disableSegmentAnimation
        storyData={storyData}
        currentIndex={segmentIndex}
        activeSlide={item.activeSlide}
        layerName={item.layerName}
      />
    </div>
  );
}
