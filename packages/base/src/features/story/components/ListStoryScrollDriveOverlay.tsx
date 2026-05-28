import { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ListStoryMapOverlayPanel } from '@/src/features/story/components/ListStoryMapOverlayPanel';
import { StoryScrollDriveMarkdown } from '@/src/features/story/components/StoryScrollDriveMarkdown';
import { useListStoryLayoutContext } from '@/src/features/story/context/ListStoryLayoutContext';
import { useCurrentSegmentIndex } from '@/src/features/story/hooks/useCurrentSegmentIndex';
import type {
  IListStoryScrollDrivePayload,
  StorySegmentDisplayMode,
  IStorySegmentViewItem,
} from '@/src/features/story/types/types';
import {
  computeListStoryOverlayHeight,
  type IListStoryOverlayPaneHeightInput,
} from '@/src/features/story/utils/computeListStoryOverlayHeight';
import { getSpectaPresentationCssVars } from '@/src/features/story/utils/spectaPresentation';
import {
  buildStorySegmentViewItems,
  getStoryMarkdownFromSlide,
} from '@/src/features/story/utils/storySegmentViewItems';
import { getSegmentDisplayMode } from '../utils/listStoryLayout';

interface IListStoryScrollDriveOverlayProps {
  model: IJupyterGISModel;
  drive: IListStoryScrollDrivePayload | null;
}

type ScrollDrivePaneConfig =
  | { type: 'markdown'; markdown: string }
  | { type: 'map'; segmentIndex: number };

const EMPTY_MARKDOWN_PANE: ScrollDrivePaneConfig = {
  type: 'markdown',
  markdown: '',
};

function buildPaneConfig(
  item: IStorySegmentViewItem | undefined,
  mode: StorySegmentDisplayMode,
): ScrollDrivePaneConfig {
  if (!item) {
    return EMPTY_MARKDOWN_PANE;
  }
  if (mode === 'map') {
    return { type: 'map', segmentIndex: item.index };
  }
  return {
    type: 'markdown',
    markdown: getStoryMarkdownFromSlide(item.activeSlide),
  };
}

function paneConfigToHeightInput(
  config: ScrollDrivePaneConfig,
  segmentIndex: number,
): IListStoryOverlayPaneHeightInput {
  if (config.type === 'map') {
    return { type: 'map', segmentIndex: config.segmentIndex };
  }
  return { type: 'markdown', segmentIndex };
}

interface IScrollDrivePaneProps {
  pane: 'from' | 'to';
  segmentIndex: number;
  config: ScrollDrivePaneConfig;
  storyData: IJGISStoryMap;
  items: IStorySegmentViewItem[];
}

function ScrollDrivePane({
  pane,
  segmentIndex,
  config,
  storyData,
  items,
}: IScrollDrivePaneProps): React.ReactElement {
  const isMap = config.type === 'map';

  return (
    <div
      data-pane={pane}
      className={`jgis-story-scroll-drive-pane jgis-story-${
        isMap ? 'map' : 'markdown'
      }-scroll-pane`}
    >
      {isMap ? (
        <ListStoryMapOverlayPanel
          storyData={storyData}
          segmentIndex={config.segmentIndex}
          items={items}
        />
      ) : config.markdown ? (
        <StoryScrollDriveMarkdown
          key={`pane-${pane}-seg-${segmentIndex}`}
          source={config.markdown}
        />
      ) : null}
    </div>
  );
}

/**
 * List-story stage overlay: markdown + map StoryViewerPanels driven by scroll.
 * The story column only scrolls the virtual track, this is the UI.
 */
export function ListStoryScrollDriveOverlay({
  model,
  drive,
}: IListStoryScrollDriveOverlayProps): JSX.Element | null {
  const overlayRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [stageHeight, setStageHeight] = useState(0);
  const [stackTravelPx, setStackTravelPx] = useState(0);
  const { layout } = useListStoryLayoutContext();
  const currentIndex = useCurrentSegmentIndex(model);

  const story = model?.getSelectedStory().story ?? null;
  const items = useMemo(
    () => buildStorySegmentViewItems(model, story),
    [model, story],
  );

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
        fromPane: paneConfigToHeightInput(fromPaneConfig, fromIndex),
        toPane: paneConfigToHeightInput(toPaneConfig, toIndex),
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

  useLayoutEffect(() => {
    if (!isDriveActive) {
      setStackTravelPx(0);
      return;
    }

    const stack = stackRef.current;
    if (!stack) {
      return;
    }

    const measure = (): void => {
      const fromPane = stack.querySelector('[data-pane="from"]');
      const gap = stack.querySelector('.jgis-story-scroll-drive-gap');
      if (!(fromPane instanceof HTMLElement) || !(gap instanceof HTMLElement)) {
        return;
      }

      const travel = fromPane.offsetHeight + gap.offsetHeight;
      setStackTravelPx(prev => (prev === travel ? prev : travel));
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(stack);

    return () => {
      ro.disconnect();
    };
  }, [isDriveActive, fromIndex, toIndex, fromPaneConfig, toPaneConfig]);

  const overlaySized = stageHeight > 0;

  if (!model || !story || !activeItem) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className={`jgis-story-markdown-overlay${
        overlaySized ? ' jgis-story-markdown-overlay--sized' : ''
      }${isDriveActive ? ' jgis-story-markdown-overlay--scroll-drive' : ''}`}
      style={
        {
          ...spectaPresentationStyle,
          '--jgis-scroll-drive-progress': displayProgress,
          ...(overlaySized
            ? {
                height: overlayHeight,
                '--jgis-scroll-travel': `${stageHeight}px`,
                '--jgis-stack-travel': `${stackTravelPx || stageHeight}px`,
                '--jgis-overlay-height': `${overlayHeight}px`,
              }
            : {}),
        } as React.CSSProperties
      }
    >
      {isDriveActive ? (
        <div ref={stackRef} className="jgis-story-scroll-drive-stack">
          <ScrollDrivePane
            pane="from"
            segmentIndex={fromIndex}
            config={fromPaneConfig}
            storyData={story}
            items={items}
          />
          <div className="jgis-story-scroll-drive-gap" aria-hidden />
          <ScrollDrivePane
            pane="to"
            segmentIndex={toIndex}
            config={toPaneConfig}
            storyData={story}
            items={items}
          />
        </div>
      ) : (
        <ScrollDrivePane
          pane="to"
          segmentIndex={toIndex}
          config={toPaneConfig}
          storyData={story}
          items={items}
        />
      )}
    </div>
  );
}
