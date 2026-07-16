import type {
  IJGISLayer,
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import type { RefObject } from 'react';

import type { IStoryViewerPanelHandle } from '@/src/features/story/StoryViewerPanel';
import type { IListStorySegmentTransition } from '@/src/features/story/types/types';

export type StoryPresentationMode = 'column' | 'verticalScroll';

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

export interface IStoryPresentationDesktopChromeProps extends IStoryPresentationChromeProps {
  containerRef: RefObject<HTMLDivElement>;
  storyViewerPanelRef: RefObject<IStoryViewerPanelHandle>;
}

export type IStoryPresentationMobileChromeProps = IStoryPresentationChromeProps;

interface IStoryStageBaseProps {
  model: IJupyterGISModel;
  isMobile: boolean;
  segmentTransition: IListStorySegmentTransition | null;
  stageRef: RefObject<HTMLDivElement>;
  controlsToolbarRef: RefObject<HTMLDivElement>;
  initialLayersReady: boolean;
  isSpecta: boolean;
  addLayer: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer: (id: string) => void;
}

export interface IVerticalScrollStoryStageProps extends IStoryStageBaseProps {
  presentationMode: 'verticalScroll';
  storyScrollContainerRef: RefObject<HTMLDivElement>;
  onSegmentTransitionChange: (
    payload: IListStorySegmentTransition | null,
  ) => void;
}

export interface IColumnStoryStageProps extends IStoryStageBaseProps {
  presentationMode: 'column';
  columnPanelContainerRef: RefObject<HTMLDivElement>;
  storyViewerPanelRef: RefObject<IStoryViewerPanelHandle>;
  onSegmentTransitionEnd: () => void;
}

export type IStoryStageProps =
  | IVerticalScrollStoryStageProps
  | IColumnStoryStageProps;
