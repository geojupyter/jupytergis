import { IJupyterGISModel, IStorySegmentLayer } from '@jupytergis/schema';
import React, { useMemo } from 'react';

import { StoryScrollDriveMarkdown } from '@/src/features/story/components/StoryScrollDriveMarkdown';
import type { IListStoryScrollDrivePayload } from '@/src/features/story/types/listStoryScrollDrive';
import { getSpectaPresentationCssVars } from '@/src/features/story/utils/spectaPresentation';

export interface IListStoryScrollDriveOverlayProps {
  model: IJupyterGISModel;
  drive: IListStoryScrollDrivePayload | null;
}

interface IScrollDrivePaneConfig {
  markdown: string;
  inactive: boolean;
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

function getScrollDrivePaneConfigs(
  drive: IListStoryScrollDrivePayload,
  fromMarkdown: string,
  toMarkdown: string,
): { from: IScrollDrivePaneConfig; to: IScrollDrivePaneConfig } | null {
  if (drive.fromMode === 'markdown' && drive.toMode === 'markdown') {
    return {
      from: { markdown: fromMarkdown, inactive: false },
      to: { markdown: toMarkdown, inactive: false },
    };
  }

  if (drive.fromMode === 'map' && drive.toMode === 'markdown') {
    return {
      from: { markdown: '', inactive: true },
      to: { markdown: toMarkdown, inactive: false },
    };
  }

  if (drive.fromMode === 'markdown' && drive.toMode === 'map') {
    return {
      from: { markdown: fromMarkdown, inactive: false },
      to: { markdown: '', inactive: true },
    };
  }

  return null;
}

interface IScrollDrivePaneProps {
  pane: 'from' | 'to';
  config: IScrollDrivePaneConfig;
}

function ScrollDrivePane({
  pane,
  config,
}: IScrollDrivePaneProps): React.ReactElement {
  const className = config.inactive
    ? 'jgis-story-markdown-scroll-pane jgis-story-markdown-scroll-pane--inactive'
    : 'jgis-story-markdown-scroll-pane';

  return (
    <div data-pane={pane} className={className} aria-hidden={config.inactive}>
      <div className="jgis-story-markdown-overlay-content">
        {config.markdown ? (
          <StoryScrollDriveMarkdown source={config.markdown} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Full-screen markdown overlay on the map stage while list story scroll-drive
 * interpolates between two segments (see useListStoryScroll).
 */
export function ListStoryScrollDriveOverlay({
  model,
  drive,
}: IListStoryScrollDriveOverlayProps): JSX.Element | null {
  const story = model?.getSelectedStory().story ?? null;
  const spectaPresentationStyle = useMemo(
    () => getSpectaPresentationCssVars(story),
    [
      story?.storyType,
      story?.presentationBgColor,
      story?.presentationTextColor,
    ],
  );

  if (!drive || !model) {
    return null;
  }

  const fromMarkdown = getStoryMarkdownForIndex(model, drive.fromIndex);
  const toMarkdown = getStoryMarkdownForIndex(model, drive.toIndex);
  const paneConfigs = getScrollDrivePaneConfigs(
    drive,
    fromMarkdown,
    toMarkdown,
  );

  if (!paneConfigs) {
    return null;
  }

  return (
    <div
      key="list-scroll-drive"
      className="jgis-story-markdown-overlay"
      style={
        {
          ...spectaPresentationStyle,
          '--jgis-scroll-drive-progress': drive.progress,
        } as React.CSSProperties
      }
    >
      <ScrollDrivePane pane="from" config={paneConfigs.from} />
      <ScrollDrivePane pane="to" config={paneConfigs.to} />
    </div>
  );
}
