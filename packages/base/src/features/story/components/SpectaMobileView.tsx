import { IJGISStoryMap, IStorySegmentLayer } from '@jupytergis/schema';
import React, { RefObject } from 'react';

import { SpectaMobileListModeContent } from '@/src/features/story/components/SpectaMobileListModeContent';
import { SpectaMobileSingleModeContent } from '@/src/features/story/components/SpectaMobileSingleModeContent';

type StoryMobileViewMode = 'single' | 'list';

interface ISpectaMobileViewProps {
  segmentContainerRef: RefObject<HTMLDivElement>;
  storyData: IJGISStoryMap | null;
  currentIndex: number;
  activeSlide: IStorySegmentLayer['parameters'] | undefined;
  layerName: string;
  handlePrev: () => void;
  handleNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function SpectaMobileView(props: ISpectaMobileViewProps): JSX.Element {
  const viewMode: StoryMobileViewMode =
    props.storyData?.storyType === 'list' ? 'list' : 'single';

  const renderModeContent: Record<StoryMobileViewMode, () => JSX.Element> = {
    single: () => <SpectaMobileSingleModeContent {...props} />,
    list: () => <SpectaMobileListModeContent />,
  };

  return renderModeContent[viewMode]();
}
