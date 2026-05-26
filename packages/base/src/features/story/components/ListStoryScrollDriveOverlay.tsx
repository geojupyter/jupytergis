import {
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ListStoryMapOverlayPanel } from '@/src/features/story/components/ListStoryMapOverlayPanel';
import { StoryScrollDriveMarkdown } from '@/src/features/story/components/StoryScrollDriveMarkdown';
import { useListStoryLayoutContext } from '@/src/features/story/context/ListStoryLayoutContext';
import { useStorySegmentViewItems } from '@/src/features/story/hooks/useStorySegmentViewItems';
import type {
  IListStoryScrollDrivePayload,
  StorySegmentDisplayMode,
} from '@/src/features/story/types/listStoryScrollDrive';
import {
  computeListStoryOverlayHeight,
  type IListStoryOverlayPaneSpec,
} from '@/src/features/story/utils/computeListStoryOverlayHeight';
import { getSegmentDisplayMode } from '@/src/features/story/utils/segmentDisplayMode';
import { getSpectaPresentationCssVars } from '@/src/features/story/utils/spectaPresentation';

export interface IListStoryScrollDriveOverlayProps {
  model: IJupyterGISModel;
  drive: IListStoryScrollDrivePayload | null;
}

type ScrollDrivePaneKind =
  | { type: 'markdown'; markdown: string }
  | { type: 'map'; segmentIndex: number };

interface IScrollDrivePaneConfig {
  kind: ScrollDrivePaneKind;
}

const EMPTY_MARKDOWN_PANE: IScrollDrivePaneConfig = {
  kind: { type: 'markdown', markdown: '' },
};

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

function buildPaneConfig(
  model: IJupyterGISModel,
  segmentIndex: number,
  mode: StorySegmentDisplayMode,
): IScrollDrivePaneConfig {
  if (mode === 'map') {
    return { kind: { type: 'map', segmentIndex } };
  }
  return {
    kind: {
      type: 'markdown',
      markdown: getStoryMarkdownForIndex(model, segmentIndex),
    },
  };
}

function getScrollDrivePaneConfigs(
  model: IJupyterGISModel,
  drive: IListStoryScrollDrivePayload,
): { from: IScrollDrivePaneConfig; to: IScrollDrivePaneConfig } {
  return {
    from: buildPaneConfig(model, drive.fromIndex, drive.fromMode),
    to: buildPaneConfig(model, drive.toIndex, drive.toMode),
  };
}

function paneConfigToSpec(
  config: IScrollDrivePaneConfig,
  segmentIndex: number,
): IListStoryOverlayPaneSpec {
  if (config.kind.type === 'map') {
    return { kind: 'map', segmentIndex: config.kind.segmentIndex };
  }
  return { kind: 'markdown', segmentIndex };
}

interface IScrollDrivePaneProps {
  pane: 'from' | 'to';
  segmentIndex: number;
  config: IScrollDrivePaneConfig;
  storyData: IJGISStoryMap;
  items: ReturnType<typeof useStorySegmentViewItems>;
}

function ScrollDrivePane({
  pane,
  segmentIndex,
  config,
  storyData,
  items,
}: IScrollDrivePaneProps): React.ReactElement {
  const isMap = config.kind.type === 'map';
  const className = `jgis-story-scroll-drive-pane${
    isMap ? ' jgis-story-map-scroll-pane' : ' jgis-story-markdown-scroll-pane'
  }`;

  return (
    <div data-pane={pane} className={className}>
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
  const { activeIndex, layout } = useListStoryLayoutContext();

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
  const activeItem = items.find(item => item.index === activeIndex);
  const activeMode = getSegmentDisplayMode(activeItem?.activeSlide);
  const overlayVisible = Boolean(model && story && activeItem);
  const displayProgress = isDriveActive ? drive.progress : 1;

  const { fromIndex, toIndex, fromPaneConfig, toPaneConfig } = useMemo(() => {
    if (!model || !activeItem) {
      return {
        fromIndex: activeIndex,
        toIndex: activeIndex,
        fromPaneConfig: EMPTY_MARKDOWN_PANE,
        toPaneConfig: EMPTY_MARKDOWN_PANE,
      };
    }

    if (drive) {
      const configs = getScrollDrivePaneConfigs(model, drive);
      return {
        fromIndex: drive.fromIndex,
        toIndex: drive.toIndex,
        fromPaneConfig: configs.from,
        toPaneConfig: configs.to,
      };
    }

    const restConfig = buildPaneConfig(model, activeIndex, activeMode);
    return {
      fromIndex: activeIndex,
      toIndex: activeIndex,
      fromPaneConfig: EMPTY_MARKDOWN_PANE,
      toPaneConfig: restConfig,
    };
  }, [model, activeItem, activeIndex, activeMode, drive]);

  const fromPaneSpec = useMemo(
    () => paneConfigToSpec(fromPaneConfig, fromIndex),
    [fromPaneConfig, fromIndex],
  );
  const toPaneSpec = useMemo(
    () => paneConfigToSpec(toPaneConfig, toIndex),
    [toPaneConfig, toIndex],
  );

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
    : isDriveActive
      ? 'scroll-drive'
      : 'at-rest';

  const overlayHeight = useMemo(
    () =>
      computeListStoryOverlayHeight({
        stageHeight,
        layout,
        fromPane: fromPaneSpec,
        toPane: toPaneSpec,
        mode: overlayHeightMode,
        activeSegmentIndex: activeIndex,
      }),
    [
      stageHeight,
      layout,
      fromPaneSpec,
      toPaneSpec,
      overlayHeightMode,
      activeIndex,
    ],
  );

  const overlaySized =
    overlayVisible && stageHeight > 0 && overlayHeightMode !== 'hidden';

  if (!model || !story || !activeItem) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className={`jgis-story-markdown-overlay${
        overlayVisible ? '' : ' jgis-story-markdown-overlay--hidden'
      }${overlaySized ? ' jgis-story-markdown-overlay--sized' : ''}`}
      aria-hidden={!overlayVisible}
      style={
        {
          ...spectaPresentationStyle,
          '--jgis-scroll-drive-progress': displayProgress,
          ...(overlaySized
            ? {
                '--jgis-overlay-height': `${overlayHeight}px`,
              }
            : {}),
        } as React.CSSProperties
      }
    >
      <ScrollDrivePane
        pane="from"
        segmentIndex={fromIndex}
        config={fromPaneConfig}
        storyData={story}
        items={items}
      />
      <ScrollDrivePane
        pane="to"
        segmentIndex={toIndex}
        config={toPaneConfig}
        storyData={story}
        items={items}
      />
    </div>
  );
}
