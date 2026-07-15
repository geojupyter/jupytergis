import type { ReactNode, RefObject } from 'react';

import type { IJupyterGISModel } from '@jupytergis/schema';

import type { IListStorySegmentTransition } from '@/src/features/story/types/types';

export type StoryPresentationMode = 'column' | 'verticalScroll';

export interface IStoryStageProps {
  model: IJupyterGISModel;
  presentationMode: StoryPresentationMode;
  isMobile: boolean;
  segmentTransition: IListStorySegmentTransition | null;
  stageRef: RefObject<HTMLDivElement>;
  controlsToolbarRef: RefObject<HTMLDivElement>;
  panels: ReactNode;
}
