import { IJupyterGISModel, IStorySegmentLayer } from '@jupytergis/schema';
import React from 'react';
import Markdown from 'react-markdown';

import type { IListStoryScrollDrivePayload } from '@/src/features/story/types/listStoryScrollDrive';

export interface IListStoryScrollDriveOverlayProps {
  model: IJupyterGISModel;
  drive: IListStoryScrollDrivePayload | null;
}

function getStoryMarkdownForIndex(
  model: IJupyterGISModel,
  index: number,
): string {
  const story = model.getSelectedStory().story;
  const segmentId = story?.storySegments?.[index];
  if (!segmentId) {
    return '';
  }
  const layer = model.getLayer(segmentId);
  if (layer?.type !== 'StorySegmentLayer') {
    return '';
  }
  const parameters = layer.parameters as IStorySegmentLayer['parameters'];
  const markdown = parameters?.content?.markdown;
  return typeof markdown === 'string' ? markdown : '';
}

/**
 * Full-screen markdown overlay on the map stage while list story scroll-drive
 * interpolates between two segments (see useListStoryScrollDrive).
 */
export function ListStoryScrollDriveOverlay({
  model,
  drive,
}: IListStoryScrollDriveOverlayProps): JSX.Element | null {
  if (!drive || !model) {
    return null;
  }

  const p = drive.progress;
  const fromMarkdown = getStoryMarkdownForIndex(model, drive.fromIndex);
  const toMarkdown = getStoryMarkdownForIndex(model, drive.toIndex);

  if (drive.fromMode === 'markdown' && drive.toMode === 'markdown') {
    return (
      <div
        className="jgis-story-markdown-overlay jgis-story-markdown-overlay-scroll-drive"
        key="list-scroll-md-md"
      >
        <div
          className="jgis-story-markdown-scroll-pane"
          style={{ transform: `translateY(${-p * 100}vh)` }}
        >
          <div className="jgis-story-markdown-scroll-pane-inner">
            <Markdown>{fromMarkdown}</Markdown>
          </div>
        </div>
        <div
          className="jgis-story-markdown-scroll-pane"
          style={{ transform: `translateY(${(1 - p) * 100}vh)` }}
        >
          <div className="jgis-story-markdown-scroll-pane-inner">
            <Markdown>{toMarkdown}</Markdown>
          </div>
        </div>
      </div>
    );
  }

  if (drive.fromMode === 'map' && drive.toMode === 'markdown') {
    return (
      <div
        className="jgis-story-markdown-overlay jgis-story-markdown-overlay-scroll-drive"
        key="list-scroll-map-md"
        style={{ transform: `translateY(${(1 - p) * 100}vh)` }}
      >
        <div className="jgis-story-markdown-scroll-pane-inner">
          <Markdown>{toMarkdown}</Markdown>
        </div>
      </div>
    );
  }

  if (drive.fromMode === 'markdown' && drive.toMode === 'map') {
    return (
      <div
        className="jgis-story-markdown-overlay jgis-story-markdown-overlay-scroll-drive"
        key="list-scroll-md-map"
        style={{ transform: `translateY(${-p * 100}vh)` }}
      >
        <div className="jgis-story-markdown-scroll-pane-inner">
          <Markdown>{fromMarkdown}</Markdown>
        </div>
      </div>
    );
  }

  return null;
}
