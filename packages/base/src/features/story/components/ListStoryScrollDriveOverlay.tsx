import { IJGISStoryMap, IJupyterGISModel, IStorySegmentLayer } from '@jupytergis/schema';
import React, { useMemo, useRef } from 'react';

import { ListStoryMapOverlayPanel } from '@/src/features/story/components/ListStoryMapOverlayPanel';
import { StoryScrollDriveMarkdown } from '@/src/features/story/components/StoryScrollDriveMarkdown';
import { useListStoryLayoutContext } from '@/src/features/story/context/ListStoryLayoutContext';
import { useStorySegmentViewItems } from '@/src/features/story/hooks/useStorySegmentViewItems';
import type {
  IListStoryScrollDrivePayload,
  StorySegmentDisplayMode,
} from '@/src/features/story/types/listStoryScrollDrive';
import { getSegmentDisplayMode } from '@/src/features/story/utils/segmentDisplayMode';
import { getSpectaPresentationCssVars } from '@/src/features/story/utils/spectaPresentation';

export interface IListStoryScrollDriveOverlayProps {
  model: IJupyterGISModel;
  drive: IListStoryScrollDrivePayload | null;
}

type ScrollDrivePaneKind =
  | { type: 'inactive' }
  | { type: 'markdown'; markdown: string }
  | { type: 'map'; segmentIndex: number };

interface IScrollDrivePaneConfig {
  kind: ScrollDrivePaneKind;
}

const INACTIVE_PANE: IScrollDrivePaneConfig = { kind: { type: 'inactive' } };

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
      from: { kind: { type: 'markdown', markdown: fromMarkdown } },
      to: { kind: { type: 'markdown', markdown: toMarkdown } },
    };
  }

  if (drive.fromMode === 'map' && drive.toMode === 'markdown') {
    return {
      from: { kind: { type: 'map', segmentIndex: drive.fromIndex } },
      to: { kind: { type: 'markdown', markdown: toMarkdown } },
    };
  }

  if (drive.fromMode === 'markdown' && drive.toMode === 'map') {
    return {
      from: { kind: { type: 'markdown', markdown: fromMarkdown } },
      to: { kind: { type: 'map', segmentIndex: drive.toIndex } },
    };
  }

  return null;
}

function isPaneInactive(config: IScrollDrivePaneConfig): boolean {
  return config.kind.type === 'inactive';
}

interface IScrollDrivePaneProps {
  pane: 'from' | 'to';
  segmentIndex: number;
  config: IScrollDrivePaneConfig;
  forceInactive: boolean;
  storyData: IJGISStoryMap;
  items: ReturnType<typeof useStorySegmentViewItems>;
}

function ScrollDrivePane({
  pane,
  segmentIndex,
  config,
  forceInactive,
  storyData,
  items,
}: IScrollDrivePaneProps): React.ReactElement {
  const inactive = forceInactive || isPaneInactive(config);
  const isMap = config.kind.type === 'map';
  const className = inactive
    ? `jgis-story-scroll-drive-pane jgis-story-scroll-drive-pane--inactive${
        isMap ? ' jgis-story-map-scroll-pane' : ' jgis-story-markdown-scroll-pane'
      }`
    : `jgis-story-scroll-drive-pane${
        isMap ? ' jgis-story-map-scroll-pane' : ' jgis-story-markdown-scroll-pane'
      }`;

  return (
    <div
      data-pane={pane}
      className={className}
      aria-hidden={inactive}
    >
      {config.kind.type === 'markdown' && config.kind.markdown ? (
        <div className="jgis-story-markdown-overlay-content">
          <div className="specta-article-host-widget specta-cell-content">
            <StoryScrollDriveMarkdown
              key={`pane-${pane}-seg-${segmentIndex}`}
              source={config.kind.markdown}
            />
          </div>
        </div>
      ) : null}
      {config.kind.type === 'map' ? (
        <ListStoryMapOverlayPanel
          storyData={storyData}
          segmentIndex={config.kind.segmentIndex}
          items={items}
        />
      ) : null}
    </div>
  );
}

interface IIdleSegmentPaneProps {
  mode: StorySegmentDisplayMode;
  segmentIndex: number;
  markdown: string;
  storyData: IJGISStoryMap;
  items: ReturnType<typeof useStorySegmentViewItems>;
}

function IdleSegmentPane({
  mode,
  segmentIndex,
  markdown,
  storyData,
  items,
}: IIdleSegmentPaneProps): React.ReactElement {
  const className =
    mode === 'map'
      ? 'jgis-story-scroll-drive-pane jgis-story-map-scroll-pane jgis-story-scroll-drive-pane--idle'
      : 'jgis-story-scroll-drive-pane jgis-story-markdown-scroll-pane jgis-story-scroll-drive-pane--idle';

  return (
    <div className={className} data-pane="idle">
      {mode === 'markdown' && markdown ? (
        <div className="jgis-story-markdown-overlay-content">
          <div className="specta-article-host-widget specta-cell-content">
            <StoryScrollDriveMarkdown
              key={`idle-seg-${segmentIndex}`}
              source={markdown}
            />
          </div>
        </div>
      ) : null}
      {mode === 'map' ? (
        <ListStoryMapOverlayPanel
          storyData={storyData}
          segmentIndex={segmentIndex}
          items={items}
        />
      ) : null}
    </div>
  );
}

/**
 * List-story stage overlay: markdown + map StoryViewerPanels driven by scroll.
 * The story column only scrolls the virtual track; segment UI lives here.
 */
export function ListStoryScrollDriveOverlay({
  model,
  drive,
}: IListStoryScrollDriveOverlayProps): JSX.Element | null {
  const lastDriveRef = useRef<IListStoryScrollDrivePayload | null>(null);
  const { activeIndex } = useListStoryLayoutContext();

  if (drive) {
    lastDriveRef.current = drive;
  }

  const story = model?.getSelectedStory().story ?? null;
  const items = useStorySegmentViewItems({ model, storyData: story });

  const spectaPresentationStyle = useMemo(
    () => getSpectaPresentationCssVars(story),
    [
      story?.storyType,
      story?.presentationBgColor,
      story?.presentationTextColor,
    ],
  );

  const isDriveActive = drive !== null;
  const renderDrive = drive ?? lastDriveRef.current;

  const paneConfigs = useMemo(() => {
    if (!model || !renderDrive) {
      return { from: INACTIVE_PANE, to: INACTIVE_PANE };
    }
    const fromMarkdown = getStoryMarkdownForIndex(model, renderDrive.fromIndex);
    const toMarkdown = getStoryMarkdownForIndex(model, renderDrive.toIndex);
    return (
      getScrollDrivePaneConfigs(renderDrive, fromMarkdown, toMarkdown) ?? {
        from: INACTIVE_PANE,
        to: INACTIVE_PANE,
      }
    );
  }, [model, renderDrive]);

  if (!model || !story) {
    return null;
  }

  const activeItem = items.find(item => item.index === activeIndex);
  const activeMode = getSegmentDisplayMode(activeItem?.activeSlide);
  const showIdlePane = !isDriveActive && activeItem !== undefined;
  const overlayVisible = isDriveActive || showIdlePane;

  const progress = renderDrive?.progress ?? 0;
  const fromIndex = renderDrive?.fromIndex ?? 0;
  const toIndex = renderDrive?.toIndex ?? 0;
  const idleMarkdown =
    activeMode === 'markdown' ? getStoryMarkdownForIndex(model, activeIndex) : '';

  return (
    <div
      className={`jgis-story-markdown-overlay${
        overlayVisible ? '' : ' jgis-story-markdown-overlay--idle'
      }`}
      aria-hidden={!overlayVisible}
      style={
        {
          ...spectaPresentationStyle,
          '--jgis-scroll-drive-progress': progress,
        } as React.CSSProperties
      }
    >
      {showIdlePane ? (
        <IdleSegmentPane
          mode={activeMode}
          segmentIndex={activeIndex}
          markdown={idleMarkdown}
          storyData={story}
          items={items}
        />
      ) : null}
      <ScrollDrivePane
        pane="from"
        segmentIndex={fromIndex}
        config={paneConfigs.from}
        forceInactive={!isDriveActive}
        storyData={story}
        items={items}
      />
      <ScrollDrivePane
        pane="to"
        segmentIndex={toIndex}
        config={paneConfigs.to}
        forceInactive={!isDriveActive}
        storyData={story}
        items={items}
      />
    </div>
  );
}
