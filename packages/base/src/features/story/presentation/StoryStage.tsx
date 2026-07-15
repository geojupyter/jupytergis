import React, { RefObject } from 'react';

import { ListStoryStageOverlay } from '@/src/features/story/components/ListStoryStageOverlay';
import { ListStoryTitleBar } from '@/src/features/story/components/ListStoryTitleBar';
import { ListStoryScrollTrackProvider } from '@/src/features/story/context/ListStoryScrollTrackContext';
import { isVerticalScrollPresentation } from '@/src/features/story/presentation/getStoryPresentationMode';
import type { IStoryStageProps } from '@/src/features/story/presentation/types';

/**
 * Map stage shell for story presentation.
 * Vertical-scroll mode mounts overlay + title bar, column mode leaves the map bare.
 */
export function StoryStage({
  model,
  presentationMode,
  isMobile,
  segmentTransition,
  stageRef,
  controlsToolbarRef,
  panels,
}: IStoryStageProps): JSX.Element {
  const verticalScroll = isVerticalScrollPresentation(presentationMode);

  return (
    <div
      ref={stageRef}
      className={`jgis-mainview-stage jgis-story-stage jgis-story-stage--${presentationMode}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      <ListStoryScrollTrackProvider model={model} enabled={verticalScroll}>
        {verticalScroll ? (
          <>
            <ListStoryTitleBar model={model} isMobile={isMobile} />
            <ListStoryStageOverlay
              model={model}
              segmentTransition={segmentTransition}
            />
          </>
        ) : null}
        <div className="jgis-panels-wrapper">{panels}</div>
        <div ref={controlsToolbarRef} className="jgis-controls-toolbar" />
      </ListStoryScrollTrackProvider>
    </div>
  );
}
