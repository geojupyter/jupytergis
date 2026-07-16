import type { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import React, { type RefObject } from 'react';

import type { IStoryViewerPanelHandle } from '@/src/features/story/StoryViewerPanel';
import { StoryStage } from '@/src/features/story/presentation/StoryStage';
import type { StoryPresentationMode } from '@/src/features/story/presentation/types';
import type { IListStorySegmentTransition } from '@/src/features/story/types/types';

export interface IMainViewStoryPresentationStageProps {
  model: IJupyterGISModel;
  storyPresentationMode: StoryPresentationMode;
  isMobile: boolean;
  segmentTransition: IListStorySegmentTransition | null;
  initialLayersReady: boolean;
  isSpectaPresentation: boolean;
  stageRef: RefObject<HTMLDivElement>;
  controlsToolbarRef: RefObject<HTMLDivElement>;
  storyScrollContainerRef: RefObject<HTMLDivElement>;
  columnPanelContainerRef: RefObject<HTMLDivElement>;
  storyViewerPanelRef: RefObject<IStoryViewerPanelHandle>;
  addLayer: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer: (id: string) => void;
  onSegmentTransitionChange: (
    payload: IListStorySegmentTransition | null,
  ) => void;
  onSegmentTransitionEnd: () => void;
}

export function MainViewStoryPresentationStage({
  model,
  storyPresentationMode,
  isMobile,
  segmentTransition,
  initialLayersReady,
  isSpectaPresentation,
  stageRef,
  controlsToolbarRef,
  storyScrollContainerRef,
  columnPanelContainerRef,
  storyViewerPanelRef,
  addLayer,
  removeLayer,
  onSegmentTransitionChange,
  onSegmentTransitionEnd,
}: IMainViewStoryPresentationStageProps): JSX.Element {
  if (storyPresentationMode === 'verticalScroll') {
    return (
      <StoryStage
        model={model}
        presentationMode="verticalScroll"
        isMobile={isMobile}
        segmentTransition={segmentTransition}
        stageRef={stageRef}
        controlsToolbarRef={controlsToolbarRef}
        initialLayersReady={initialLayersReady}
        isSpecta={isSpectaPresentation}
        addLayer={addLayer}
        removeLayer={removeLayer}
        storyScrollContainerRef={storyScrollContainerRef}
        onSegmentTransitionChange={onSegmentTransitionChange}
      />
    );
  }

  return (
    <StoryStage
      model={model}
      presentationMode="column"
      isMobile={isMobile}
      segmentTransition={segmentTransition}
      stageRef={stageRef}
      controlsToolbarRef={controlsToolbarRef}
      initialLayersReady={initialLayersReady}
      isSpecta={isSpectaPresentation}
      addLayer={addLayer}
      removeLayer={removeLayer}
      columnPanelContainerRef={columnPanelContainerRef}
      storyViewerPanelRef={storyViewerPanelRef}
      onSegmentTransitionEnd={onSegmentTransitionEnd}
    />
  );
}
