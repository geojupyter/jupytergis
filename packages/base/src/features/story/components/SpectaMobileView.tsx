import {
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import React, { RefObject } from 'react';

import { SpectaMobileListModeContent } from '@/src/features/story/components/SpectaMobileListModeContent';
import { SpectaMobileSingleModeContent } from '@/src/features/story/components/SpectaMobileSingleModeContent';
import { isVerticalScrollPresentation } from '@/src/features/story/presentation/getStoryPresentationMode';
import type { StoryPresentationMode } from '@/src/features/story/presentation/types';
import type { IListStorySegmentTransition } from '@/src/features/story/types/types';

type StoryMobileViewMode = 'single' | 'list';

interface ISpectaMobileViewProps {
  model: IJupyterGISModel;
  presentationMode: StoryPresentationMode;
  segmentContainerRef: RefObject<HTMLDivElement>;
  storyData: IJGISStoryMap | null;
  currentIndex: number;
  setIndex: (index: number) => void;
  activeSlide: IStorySegmentLayer['parameters'] | undefined;
  layerName: string;
  handlePrev: () => void;
  handleNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onSegmentTransitionChange?: (
    payload: IListStorySegmentTransition | null,
  ) => void;
}

export function SpectaMobileView({
  model,
  presentationMode,
  segmentContainerRef,
  storyData,
  currentIndex,
  setIndex,
  activeSlide,
  layerName,
  handlePrev,
  handleNext,
  hasPrev,
  hasNext,
  onSegmentTransitionChange,
}: ISpectaMobileViewProps): JSX.Element {
  const viewMode: StoryMobileViewMode = isVerticalScrollPresentation(
    presentationMode,
  )
    ? 'list'
    : 'single';

  const renderModeContent: Record<StoryMobileViewMode, () => JSX.Element> = {
    single: () => (
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
    ),
    list: () => (
      <SpectaMobileListModeContent
        model={model}
        storyData={storyData}
        currentIndex={currentIndex}
        setIndex={setIndex}
        onSegmentTransitionChange={onSegmentTransitionChange}
      />
    ),
  };

  return renderModeContent[viewMode]();
}
