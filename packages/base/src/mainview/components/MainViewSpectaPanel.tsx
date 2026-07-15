import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import React, { RefObject } from 'react';

import { StoryPresentationRoot } from '@/src/features/story/presentation/StoryPresentationRoot';
import type { IStoryViewerPanelHandle } from '@/src/features/story/StoryViewerPanel';
import type { IListStorySegmentTransition } from '@/src/features/story/types/types';

export interface IMainViewSpectaPanelProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  isMobile: boolean;
  initialLayersReady: boolean;
  containerRef: RefObject<HTMLDivElement>;
  storyViewerPanelRef: RefObject<IStoryViewerPanelHandle>;
  addLayer: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer: (id: string) => void;
  onSegmentTransitionEnd: () => void;
  onSegmentTransitionChange: (
    payload: IListStorySegmentTransition | null,
  ) => void;
}

export function MainViewSpectaPanel({
  model,
  isSpecta,
  isMobile,
  initialLayersReady,
  containerRef,
  storyViewerPanelRef,
  addLayer,
  removeLayer,
  onSegmentTransitionEnd,
  onSegmentTransitionChange,
}: IMainViewSpectaPanelProps): JSX.Element | null {
  if (!initialLayersReady) {
    return null;
  }

  return (
    <StoryPresentationRoot
      model={model}
      isSpecta={isSpecta}
      isMobile={isMobile}
      onSegmentTransitionEnd={onSegmentTransitionEnd}
      containerRef={containerRef}
      storyViewerPanelRef={storyViewerPanelRef}
      addLayer={addLayer}
      removeLayer={removeLayer}
      onSegmentTransitionChange={onSegmentTransitionChange}
    />
  );
}
