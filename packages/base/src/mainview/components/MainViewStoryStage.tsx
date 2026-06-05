import { IJupyterGISModel } from '@jupytergis/schema';
import React, { RefObject } from 'react';

import { ListStoryStageOverlay } from '@/src/features/story/components/ListStoryStageOverlay';
import { ListStoryScrollTrackProvider } from '@/src/features/story/context/ListStoryScrollTrackContext';
import type { IListStorySegmentTransition } from '@/src/features/story/types/types';

export interface IMainViewStoryStageProps {
  model: IJupyterGISModel;
  isListStory: boolean;
  segmentTransition: IListStorySegmentTransition | null;
  stageRef: RefObject<HTMLDivElement>;
  controlsToolbarRef: RefObject<HTMLDivElement>;
  panels: React.ReactNode;
}

export function MainViewStoryStage({
  model,
  isListStory,
  segmentTransition,
  stageRef,
  controlsToolbarRef,
  panels,
}: IMainViewStoryStageProps): JSX.Element {
  return (
    <div
      ref={stageRef}
      className="jgis-mainview-stage"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      <ListStoryScrollTrackProvider model={model} enabled={isListStory}>
        {isListStory ? (
          <ListStoryStageOverlay
            model={model}
            segmentTransition={segmentTransition}
          />
        ) : null}
        <div className="jgis-panels-wrapper">{panels}</div>
        <div ref={controlsToolbarRef} className="jgis-controls-toolbar"></div>
      </ListStoryScrollTrackProvider>
    </div>
  );
}
