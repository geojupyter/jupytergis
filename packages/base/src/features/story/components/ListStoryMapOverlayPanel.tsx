import { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import StoryViewerPanel from '@/src/features/story/StoryViewerPanel';
import type { IStorySegmentViewItem } from '@/src/features/story/types/types';

interface IListStoryMapOverlayPanelProps {
  model: IJupyterGISModel;
  storyData: IJGISStoryMap;
  segmentIndex: number;
  items: IStorySegmentViewItem[];
  panelWidth?: string;
  isMobile: boolean;
}

/** Map segment chrome on the list-story stage overlay (not in the scroll column). */
export function ListStoryMapOverlayPanel({
  model,
  storyData,
  segmentIndex,
  items,
  panelWidth,
  isMobile,
}: IListStoryMapOverlayPanelProps): JSX.Element | null {
  const item = items.find(entry => entry.index === segmentIndex);
  if (!item) {
    return null;
  }

  const widthStyle =
    !isMobile && panelWidth ? { width: panelWidth } : undefined;

  return (
    <div className="jgis-story-map-overlay-content" style={widthStyle}>
      <StoryViewerPanel
        model={model}
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
