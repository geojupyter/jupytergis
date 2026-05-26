import { IJGISStoryMap, IJupyterGISModel, IStorySegmentLayer } from '@jupytergis/schema';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ListStoryMapOverlayPanel } from '@/src/features/story/components/ListStoryMapOverlayPanel';
import { StoryScrollDriveMarkdown } from '@/src/features/story/components/StoryScrollDriveMarkdown';
import { useListStoryLayoutContext } from '@/src/features/story/context/ListStoryLayoutContext';
import {
  type IListStoryOverlayPaneSpec,
  useListStoryOverlayHeight,
} from '@/src/features/story/hooks/useListStoryOverlayHeight';
import { useStorySegmentViewItems } from '@/src/features/story/hooks/useStorySegmentViewItems';
import type { IListStoryScrollDrivePayload } from '@/src/features/story/types/listStoryScrollDrive';
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

  if (drive.fromMode === 'map' && drive.toMode === 'map') {
    return {
      from: { kind: { type: 'map', segmentIndex: drive.fromIndex } },
      to: { kind: { type: 'map', segmentIndex: drive.toIndex } },
    };
  }

  return null;
}

function isPaneInactive(config: IScrollDrivePaneConfig): boolean {
  return config.kind.type === 'inactive';
}

function paneConfigToSpec(
  config: IScrollDrivePaneConfig,
  segmentIndex: number,
): IListStoryOverlayPaneSpec {
  if (config.kind.type === 'inactive') {
    return { kind: 'inactive', segmentIndex };
  }
  if (config.kind.type === 'map') {
    return { kind: 'map', segmentIndex: config.kind.segmentIndex };
  }
  return { kind: 'markdown', segmentIndex };
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

interface IIdleMarkdownPaneProps {
  segmentIndex: number;
  markdown: string;
}

function IdleMarkdownPane({
  segmentIndex,
  markdown,
}: IIdleMarkdownPaneProps): React.ReactElement {
  return (
    <div
      className="jgis-story-scroll-drive-pane jgis-story-markdown-scroll-pane jgis-story-scroll-drive-pane--idle"
      data-pane="idle"
    >
      <div className="jgis-story-markdown-overlay-content">
        <div className="specta-article-host-widget specta-cell-content">
          <StoryScrollDriveMarkdown
            key={`idle-seg-${segmentIndex}`}
            source={markdown}
          />
        </div>
      </div>
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const [stageHeight, setStageHeight] = useState(0);
  const lastDriveRef = useRef<IListStoryScrollDrivePayload | null>(null);
  const { activeIndex, layout } = useListStoryLayoutContext();

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

  const activeItem = items.find(item => item.index === activeIndex);
  const activeMode = getSegmentDisplayMode(activeItem?.activeSlide);
  const showIdleMarkdown =
    Boolean(model && story) &&
    !isDriveActive &&
    activeMode === 'markdown' &&
    activeItem !== undefined;
  const mapAtRest =
    Boolean(model && story) &&
    !isDriveActive &&
    activeMode === 'map' &&
    activeItem !== undefined;
  const overlayVisible = isDriveActive || showIdleMarkdown || mapAtRest;

  const driveProgress = renderDrive?.progress ?? 0;
  const displayProgress = isDriveActive ? driveProgress : mapAtRest ? 1 : 0;
  const fromIndex = renderDrive?.fromIndex ?? activeIndex;
  const toIndex = renderDrive?.toIndex ?? activeIndex;

  const toPaneConfig = useMemo((): IScrollDrivePaneConfig => {
    if (mapAtRest) {
      return { kind: { type: 'map', segmentIndex: activeIndex } };
    }
    return paneConfigs.to;
  }, [mapAtRest, activeIndex, paneConfigs.to]);
  const fromPaneConfig = paneConfigs.from;

  const fromPaneSpec = useMemo(
    () => paneConfigToSpec(fromPaneConfig, fromIndex),
    [fromPaneConfig, fromIndex],
  );
  const toPaneSpec = useMemo(
    () => paneConfigToSpec(toPaneConfig, toIndex),
    [toPaneConfig, toIndex],
  );

  const idleMarkdown =
    showIdleMarkdown && model
      ? getStoryMarkdownForIndex(model, activeIndex)
      : '';

  useLayoutEffect(() => {
    const parent = overlayRef.current?.parentElement;
    if (!parent) {
      setStageHeight(0);
      return;
    }
    const update = (): void => {
      const next = parent.clientHeight;
      setStageHeight(prev => (prev === next ? prev : next));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(parent);
    return () => {
      ro.disconnect();
    };
  }, [model, story, overlayVisible]);

  const overlayHeightMode = !overlayVisible
    ? 'hidden'
    : showIdleMarkdown
      ? 'idle-markdown'
      : mapAtRest
        ? 'map-at-rest'
        : isDriveActive
          ? 'scroll-drive'
          : 'hidden';

  const overlayHeight = useListStoryOverlayHeight({
    stageHeight,
    layout,
    fromPane: fromPaneSpec,
    toPane: toPaneSpec,
    mode: overlayHeightMode,
    activeSegmentIndex: activeIndex,
  });

  const overlaySized =
    overlayVisible && stageHeight > 0 && overlayHeightMode !== 'hidden';

  if (!model || !story) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className={`jgis-story-markdown-overlay${
        overlayVisible ? '' : ' jgis-story-markdown-overlay--idle'
      }${overlaySized ? ' jgis-story-markdown-overlay--sized' : ''}`}
      aria-hidden={!overlayVisible}
      style={
        {
          ...spectaPresentationStyle,
          '--jgis-scroll-drive-progress': displayProgress,
          ...(overlaySized
            ? {
                height: overlayHeight,
                '--jgis-overlay-height': `${overlayHeight}px`,
              }
            : {}),
        } as React.CSSProperties
      }
    >
      {showIdleMarkdown ? (
        <IdleMarkdownPane
          segmentIndex={activeIndex}
          markdown={idleMarkdown}
        />
      ) : null}
      <ScrollDrivePane
        pane="from"
        segmentIndex={fromIndex}
        config={fromPaneConfig}
        forceInactive={!isDriveActive}
        storyData={story}
        items={items}
      />
      <ScrollDrivePane
        pane="to"
        segmentIndex={toIndex}
        config={toPaneConfig}
        forceInactive={!isDriveActive && !mapAtRest}
        storyData={story}
        items={items}
      />
    </div>
  );
}
