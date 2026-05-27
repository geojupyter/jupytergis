import { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ListStoryMapOverlayPanel } from '@/src/features/story/components/ListStoryMapOverlayPanel';
import { StoryScrollDriveMarkdown } from '@/src/features/story/components/StoryScrollDriveMarkdown';
import { useListStoryLayoutContext } from '@/src/features/story/context/ListStoryLayoutContext';
import { useCurrentSegmentIndex } from '@/src/features/story/hooks/useCurrentSegmentIndex';
import {
  useStorySegmentViewItems,
  type IStorySegmentViewItem,
} from '@/src/features/story/hooks/useStorySegmentViewItems';
import type {
  IListStoryScrollDrivePayload,
  StorySegmentDisplayMode,
} from '@/src/features/story/types/listStoryScrollDrive';
import {
  computeListStoryOverlayHeight,
  type IListStoryOverlayPaneSpec,
} from '@/src/features/story/utils/computeListStoryOverlayHeight';
import { getStoryMarkdownFromSlide } from '@/src/features/story/utils/listStoryMarkdownSegments';
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

function buildPaneConfig(
  item: IStorySegmentViewItem | undefined,
  mode: StorySegmentDisplayMode,
): IScrollDrivePaneConfig {
  if (!item) {
    return EMPTY_MARKDOWN_PANE;
  }
  if (mode === 'map') {
    return { kind: { type: 'map', segmentIndex: item.index } };
  }
  return {
    kind: {
      type: 'markdown',
      markdown: getStoryMarkdownFromSlide(item.activeSlide),
    },
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
  const { layout } = useListStoryLayoutContext();
  const currentIndex = useCurrentSegmentIndex(model);

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
  const activeItem = items.find(item => item.index === currentIndex);
  const activeMode = getSegmentDisplayMode(activeItem?.activeSlide);
  const displayProgress = isDriveActive ? drive.progress : 1;

  const { fromIndex, toIndex, fromPaneConfig, toPaneConfig } = useMemo(() => {
    if (!model || !activeItem) {
      return {
        fromIndex: currentIndex,
        toIndex: currentIndex,
        fromPaneConfig: EMPTY_MARKDOWN_PANE,
        toPaneConfig: EMPTY_MARKDOWN_PANE,
      };
    }

    if (drive) {
      return {
        fromIndex: drive.fromIndex,
        toIndex: drive.toIndex,
        fromPaneConfig: buildPaneConfig(
          items.find(item => item.index === drive.fromIndex),
          drive.fromMode,
        ),
        toPaneConfig: buildPaneConfig(
          items.find(item => item.index === drive.toIndex),
          drive.toMode,
        ),
      };
    }

    return {
      fromIndex: currentIndex,
      toIndex: currentIndex,
      fromPaneConfig: EMPTY_MARKDOWN_PANE,
      toPaneConfig: buildPaneConfig(activeItem, activeMode),
    };
  }, [items, activeItem, currentIndex, activeMode, drive]);

  const overlayHeightMode = isDriveActive ? 'scroll-drive' : 'at-rest';

  const overlayHeight = useMemo(
    () =>
      computeListStoryOverlayHeight({
        stageHeight,
        layout,
        fromPane: paneConfigToSpec(fromPaneConfig, fromIndex),
        toPane: paneConfigToSpec(toPaneConfig, toIndex),
        mode: overlayHeightMode,
        activeSegmentIndex: currentIndex,
      }),
    [
      stageHeight,
      layout,
      fromPaneConfig,
      fromIndex,
      toPaneConfig,
      toIndex,
      overlayHeightMode,
      currentIndex,
    ],
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
  }, [model, story]);

  const overlaySized = stageHeight > 0;

  if (!model || !story || !activeItem) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className={`jgis-story-markdown-overlay${
        overlaySized ? ' jgis-story-markdown-overlay--sized' : ''
      }`}
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
