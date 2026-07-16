import React from 'react';

import { ListStoryStageOverlay } from '@/src/features/story/components/ListStoryStageOverlay';
import { ListStoryStageScrollHost } from '@/src/features/story/components/ListStoryStageScrollHost';
import { ListStoryTitleBar } from '@/src/features/story/components/ListStoryTitleBar';
import { ListStoryScrollTrackProvider } from '@/src/features/story/context/ListStoryScrollTrackContext';
import { ColumnStoryPanel } from '@/src/features/story/presentation/ColumnStoryPanel';
import type { IStoryStageProps } from '@/src/features/story/presentation/types';

/**
 * Map stage shell for story presentation.
 */
export function StoryStage(props: IStoryStageProps): JSX.Element {
  const {
    model,
    presentationMode,
    isMobile,
    segmentTransition,
    stageRef,
    controlsToolbarRef,
    initialLayersReady,
    addLayer,
    removeLayer,
  } = props;

  const verticalScroll = presentationMode === 'verticalScroll';

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
            <ListStoryStageScrollHost
              model={model}
              isSpecta={props.isSpecta}
              isMobile={isMobile}
              initialLayersReady={initialLayersReady}
              scrollContainerRef={props.storyScrollContainerRef}
              addLayer={addLayer}
              removeLayer={removeLayer}
              onSegmentTransitionChange={props.onSegmentTransitionChange}
            />
          </>
        ) : null}
        {presentationMode === 'column' && props.isSpecta ? (
          <div className="jgis-panels-wrapper">
            <ColumnStoryPanel
              model={model}
              isMobile={isMobile}
              initialLayersReady={initialLayersReady}
              containerRef={props.columnPanelContainerRef}
              storyViewerPanelRef={props.storyViewerPanelRef}
              addLayer={addLayer}
              removeLayer={removeLayer}
              onSegmentTransitionEnd={props.onSegmentTransitionEnd}
            />
          </div>
        ) : null}
        <div ref={controlsToolbarRef} className="jgis-controls-toolbar" />
      </ListStoryScrollTrackProvider>
    </div>
  );
}
