import {
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import React, { RefObject } from 'react';

import { SpectaMobileListModeContent } from '@/src/features/story/components/SpectaMobileListModeContent';
import { SpectaMobileSingleModeContent } from '@/src/features/story/components/SpectaMobileSingleModeContent';
import type { IListStorySegmentTransition } from '@/src/features/story/types/types';
import { STORY_TYPE } from '@/src/types';

type StoryMobileViewMode = 'single' | 'list';

interface ISpectaMobileViewProps {
  model: IJupyterGISModel;
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
  const viewMode: StoryMobileViewMode =
    storyData?.storyType === STORY_TYPE.verticalScroll ? 'list' : 'single';

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
