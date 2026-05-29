import {
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import React, { RefObject } from 'react';

import { SpectaMobileListModeContent } from '@/src/features/story/components/SpectaMobileListModeContent';
import { SpectaMobileSingleModeContent } from '@/src/features/story/components/SpectaMobileSingleModeContent';
import type { IListStorySegmentTransition } from '@/src/features/story/types/types';

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
  setIndex,
  onSegmentTransitionChange,
  ...singleModeProps
}: ISpectaMobileViewProps): JSX.Element {
  const viewMode: StoryMobileViewMode =
    singleModeProps.storyData?.storyType === 'list' ? 'list' : 'single';

  const renderModeContent: Record<StoryMobileViewMode, () => JSX.Element> = {
    single: () => <SpectaMobileSingleModeContent {...singleModeProps} />,
    list: () => (
      <SpectaMobileListModeContent
        model={model}
        storyData={singleModeProps.storyData}
        currentIndex={singleModeProps.currentIndex}
        setIndex={setIndex}
        onSegmentTransitionChange={onSegmentTransitionChange}
      />
    ),
  };

  return renderModeContent[viewMode]();
}
