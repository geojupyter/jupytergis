import type {
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import type { RefObject } from 'react';

import type { IStoryViewerPanelHandle } from '@/src/features/story/StoryViewerPanel';

import type { StoryPresentationMode } from './types';

/** Story map state shared by column and vertical-scroll chrome. */
export interface IStoryPresentationChromeProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
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
  showGradient: boolean;
}

export interface IStoryPresentationDesktopChromeProps
  extends IStoryPresentationChromeProps {
  containerRef: RefObject<HTMLDivElement>;
  storyViewerPanelRef: RefObject<IStoryViewerPanelHandle>;
}

export interface IStoryPresentationMobileChromeProps
  extends IStoryPresentationChromeProps {}
