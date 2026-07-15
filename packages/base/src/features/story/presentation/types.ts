import type { ReactNode, RefObject } from 'react';

import type { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';

import type { IListStorySegmentTransition } from '@/src/features/story/types/types';

export type StoryPresentationMode = 'column' | 'verticalScroll';

export interface IStoryStageProps {
  model: IJupyterGISModel;
  presentationMode: StoryPresentationMode;
  isMobile: boolean;
  segmentTransition: IListStorySegmentTransition | null;
  stageRef: RefObject<HTMLDivElement>;
  controlsToolbarRef: RefObject<HTMLDivElement>;
  storyScrollContainerRef?: RefObject<HTMLDivElement>;
  initialLayersReady?: boolean;
  isSpecta?: boolean;
  addLayer?: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer?: (id: string) => void;
  onSegmentTransitionChange?: (
    payload: IListStorySegmentTransition | null,
  ) => void;
  panels: ReactNode;
}
