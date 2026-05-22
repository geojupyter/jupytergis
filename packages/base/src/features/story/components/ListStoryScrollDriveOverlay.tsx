import { IJupyterGISModel, IStorySegmentLayer } from '@jupytergis/schema';
import React, { useMemo, useRef } from 'react';

import { StoryScrollDriveMarkdown } from '@/src/features/story/components/StoryScrollDriveMarkdown';
import {
  getLayoutSegmentHeight,
  useListStoryLayoutContext,
} from '@/src/features/story/context/ListStoryLayoutContext';
import type { IListStoryScrollDrivePayload } from '@/src/features/story/types/listStoryScrollDrive';
import { markdownScrollPaneHeightStyle } from '@/src/features/story/utils/markdownScrollPaneHeight';
import { getSpectaPresentationCssVars } from '@/src/features/story/utils/spectaPresentation';

export interface IListStoryScrollDriveOverlayProps {
  model: IJupyterGISModel;
  drive: IListStoryScrollDrivePayload | null;
}

interface IScrollDrivePaneConfig {
  markdown: string;
  inactive: boolean;
}

const IDLE_PANE: IScrollDrivePaneConfig = { markdown: '', inactive: true };

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
  segmentIndex: number;
  config: IScrollDrivePaneConfig;
  heightPx: number | undefined;
  forceInactive: boolean;
}

function ScrollDrivePane({
  pane,
  segmentIndex,
  config,
  heightPx,
  forceInactive,
}: IScrollDrivePaneProps): React.ReactElement {
  const inactive = forceInactive || config.inactive;
  const className = inactive
    ? 'jgis-story-markdown-scroll-pane jgis-story-markdown-scroll-pane--inactive'
    : 'jgis-story-markdown-scroll-pane';

  return (
    <div
      data-pane={pane}
      className={className}
      style={markdownScrollPaneHeightStyle(heightPx)}
      aria-hidden={inactive}
    >
      <div className="jgis-story-markdown-overlay-content">
        {config.markdown ? (
          <div className="specta-article-host-widget specta-cell-content">
            <StoryScrollDriveMarkdown
              key={`pane-${pane}-seg-${segmentIndex}`}
              source={config.markdown}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Persistent list-story markdown overlay on the map stage. Stays mounted while
 * scroll-drive is enabled; hidden when drive is null so rendermime panes survive.
 */
export function ListStoryScrollDriveOverlay({
  model,
  drive,
}: IListStoryScrollDriveOverlayProps): JSX.Element | null {
  const { layout } = useListStoryLayoutContext();
  const lastDriveRef = useRef<IListStoryScrollDrivePayload | null>(null);

  if (drive) {
    lastDriveRef.current = drive;
  }

  const story = model?.getSelectedStory().story ?? null;
  const spectaPresentationStyle = useMemo(
    () => getSpectaPresentationCssVars(story),
    [
      story?.storyType,
      story?.presentationBgColor,
      story?.presentationTextColor,
    ],
  );

  if (!model) {
    return null;
  }

  const isActive = drive !== null;
  const renderDrive = drive ?? lastDriveRef.current;

  const paneConfigs = useMemo(() => {
    if (!renderDrive) {
      return { from: IDLE_PANE, to: IDLE_PANE };
    }
    const fromMarkdown = getStoryMarkdownForIndex(model, renderDrive.fromIndex);
    const toMarkdown = getStoryMarkdownForIndex(model, renderDrive.toIndex);
    return (
      getScrollDrivePaneConfigs(renderDrive, fromMarkdown, toMarkdown) ?? {
        from: IDLE_PANE,
        to: IDLE_PANE,
      }
    );
  }, [model, renderDrive]);

  const progress = renderDrive?.progress ?? 0;
  const fromIndex = renderDrive?.fromIndex ?? 0;
  const toIndex = renderDrive?.toIndex ?? 0;

  return (
    <div
      className={`jgis-story-markdown-overlay${isActive ? '' : ' jgis-story-markdown-overlay--idle'}`}
      aria-hidden={!isActive}
      style={
        {
          ...spectaPresentationStyle,
          '--jgis-scroll-drive-progress': progress,
        } as React.CSSProperties
      }
    >
      <ScrollDrivePane
        pane="from"
        segmentIndex={fromIndex}
        config={paneConfigs.from}
        heightPx={getLayoutSegmentHeight(layout, fromIndex)}
        forceInactive={!isActive}
      />
      <ScrollDrivePane
        pane="to"
        segmentIndex={toIndex}
        config={paneConfigs.to}
        heightPx={getLayoutSegmentHeight(layout, toIndex)}
        forceInactive={!isActive}
      />
    </div>
  );
}
