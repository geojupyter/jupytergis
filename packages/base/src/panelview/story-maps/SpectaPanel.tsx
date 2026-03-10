import { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import { MobileSpectaPanel } from './MobileSpectaPanel';
import StoryViewerPanel, { IStoryViewerPanelHandle } from './StoryViewerPanel';
import SpectaPresentationProgressBar from '../../statusbar/SpectaPresentationProgressBar';

export interface ISpectaPanelProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  isMobile?: boolean;
  onSegmentTransitionEnd: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
  storyViewerPanelRef: React.RefObject<IStoryViewerPanelHandle>;
}

export function SpectaPanel({
  model,
  isSpecta,
  isMobile = false,
  onSegmentTransitionEnd,
  containerRef,
  storyViewerPanelRef,
}: ISpectaPanelProps) {
  if (isMobile) {
    return <MobileSpectaPanel model={model} />;
  }
  return (
    <>
      <div className="jgis-specta-right-panel-container-mod jgis-right-panel-container">
        <div ref={containerRef} className="jgis-specta-story-panel-container">
          <StoryViewerPanel
            ref={storyViewerPanelRef}
            model={model}
            isSpecta={isSpecta}
            className="jgis-story-viewer-panel-specta-mod"
            onSegmentTransitionEnd={onSegmentTransitionEnd}
          />
        </div>
      </div>
      <SpectaPresentationProgressBar model={model} />
    </>
  );
}
