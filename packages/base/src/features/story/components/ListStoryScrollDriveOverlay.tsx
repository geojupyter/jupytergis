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
  | { type: 'markdown'; markdown: string }
  | { type: 'map'; segmentIndex: number };

interface IScrollDrivePaneConfig {
  kind: ScrollDrivePaneKind;
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

function buildPaneConfig(
  model: IJupyterGISModel,
  segmentIndex: number,
  mode: StorySegmentDisplayMode,
): IScrollDrivePaneConfig {
  if (mode === 'map') {
    return { kind: { type: 'map', segmentIndex } };
  }
  return {
    kind: { type: 'markdown', markdown: getStoryMarkdownForIndex(model, segmentIndex) },
  };
}

function getScrollDrivePaneConfigs(
  model: IJupyterGISModel,
  drive: IListStoryScrollDrivePayload,
): { from: IScrollDrivePaneConfig; to: IScrollDrivePaneConfig } {
  const fromMarkdown = getStoryMarkdownForIndex(model, drive.fromIndex);
  const toMarkdown = getStoryMarkdownForIndex(model, drive.toIndex);

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

  return {
    from: { kind: { type: 'map', segmentIndex: drive.fromIndex } },
    to: { kind: { type: 'map', segmentIndex: drive.toIndex } },
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
        fromPaneConfig: { kind: { type: 'markdown' as const, markdown: '' } },
        toPaneConfig: { kind: { type: 'markdown' as const, markdown: '' } },
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
      fromPaneConfig: restConfig,
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
                height: overlayHeight,
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
