import type { ReactNode, RefObject } from 'react';

import type { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';

import type { IStoryViewerPanelHandle } from '@/src/features/story/StoryViewerPanel';
import type { IListStorySegmentTransition } from '@/src/features/story/types/types';

export type StoryPresentationMode = 'column' | 'verticalScroll';

export interface IStoryPresentationRootProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  isMobile: boolean;
  onSegmentTransitionEnd: () => void;
  containerRef: RefObject<HTMLDivElement>;
  storyViewerPanelRef: RefObject<IStoryViewerPanelHandle>;
  addLayer?: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer?: (id: string) => void;
  onSegmentTransitionChange?: (
    payload: IListStorySegmentTransition | null,
  ) => void;
}

export interface IStoryStageProps {
  model: IJupyterGISModel;
  presentationMode: StoryPresentationMode;
  isMobile: boolean;
  segmentTransition: IListStorySegmentTransition | null;
  stageRef: RefObject<HTMLDivElement>;
  controlsToolbarRef: RefObject<HTMLDivElement>;
  panels: ReactNode;
}
