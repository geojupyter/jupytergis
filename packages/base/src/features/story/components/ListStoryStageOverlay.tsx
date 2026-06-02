import { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ListStoryMapOverlayPanel } from '@/src/features/story/components/ListStoryMapOverlayPanel';
import { ListStoryOverlayMarkdown } from '@/src/features/story/components/ListStoryOverlayMarkdown';
import { useCurrentSegmentIndex } from '@/src/features/story/hooks/useCurrentSegmentIndex';
import type {
  IListStorySegmentTransition,
  StorySegmentDisplayMode,
  IStorySegmentViewItem,
} from '@/src/features/story/types/types';
import { getSpectaPresentationCssVars } from '@/src/features/story/utils/spectaPresentation';
import {
  buildStorySegmentViewItems,
  getStoryMarkdownFromSlide,
} from '@/src/features/story/utils/storySegmentViewItems';
import { getSegmentDisplayMode } from '../utils/listStoryScrollTrack';

interface IListStoryStageOverlayProps {
  model: IJupyterGISModel;
  segmentTransition: IListStorySegmentTransition | null;
}

type SegmentOverlayPaneConfig =
  | { type: 'markdown'; markdown: string }
  | { type: 'map'; segmentIndex: number };

const EMPTY_MARKDOWN_PANE: SegmentOverlayPaneConfig = {
  type: 'markdown',
  markdown: '',
};

function buildPaneConfig(
  item: IStorySegmentViewItem | undefined,
  mode: StorySegmentDisplayMode,
): SegmentOverlayPaneConfig {
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

interface ISegmentOverlayPaneProps {
  pane: 'from' | 'to';
  segmentIndex: number;
  config: SegmentOverlayPaneConfig;
  storyData: IJGISStoryMap;
  items: IStorySegmentViewItem[];
}

function SegmentOverlayPane({
  pane,
  segmentIndex,
  config,
  storyData,
  items,
}: ISegmentOverlayPaneProps): React.ReactElement {
  const isMap = config.type === 'map';

  return (
    <div
      data-pane={pane}
      className={`jgis-story-segment-overlay-pane jgis-story-${
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
        <ListStoryOverlayMarkdown
          key={`pane-${pane}-seg-${segmentIndex}`}
          source={config.markdown}
        />
      ) : null}
    </div>
  );
}

/**
 * List-story stage overlay: map + markdown segments on the map stage.
 * The story column scrolls only the virtual track; this is the visible UI.
 */
export function ListStoryStageOverlay({
  model,
  segmentTransition,
}: IListStoryStageOverlayProps): JSX.Element | null {
  const overlayRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [stageHeight, setStageHeight] = useState(0);
  const [transitionTranslatePx, setTransitionTranslatePx] = useState(0);
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

  const isTransitioning = segmentTransition !== null;
  const activeItem = items.find(item => item.index === currentIndex);
  const activeMode = getSegmentDisplayMode(activeItem?.activeSlide);
  const effectiveTransition = useMemo((): IListStorySegmentTransition => {
    if (segmentTransition) {
      return segmentTransition;
    }

    return {
      progress: 0,
      fromIndex: currentIndex,
      toIndex: currentIndex,
      fromMode: activeMode,
      toMode: activeMode,
    };
  }, [segmentTransition, currentIndex, activeMode]);

  const { fromIndex, toIndex, fromPaneConfig, toPaneConfig } = useMemo(() => {
    if (!model || !activeItem) {
      return {
        fromIndex: currentIndex,
        toIndex: currentIndex,
        fromPaneConfig: EMPTY_MARKDOWN_PANE,
        toPaneConfig: EMPTY_MARKDOWN_PANE,
      };
    }

    return {
      fromIndex: effectiveTransition.fromIndex,
      toIndex: effectiveTransition.toIndex,
      fromPaneConfig: buildPaneConfig(
        items.find(item => item.index === effectiveTransition.fromIndex),
        effectiveTransition.fromMode,
      ),
      toPaneConfig: buildPaneConfig(
        items.find(item => item.index === effectiveTransition.toIndex),
        effectiveTransition.toMode,
      ),
    };
  }, [items, activeItem, currentIndex, effectiveTransition, model]);

  const overlayHeight = Math.max(stageHeight, 0);

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
    const stack = stackRef.current;
    if (!stack) {
      return;
    }

    const measure = (): void => {
      const fromPane = stack.querySelector('[data-pane="from"]');
      const gap = stack.querySelector('.jgis-story-segment-transition-gap');
      if (!(fromPane instanceof HTMLElement) || !(gap instanceof HTMLElement)) {
        return;
      }

      const travel = fromPane.offsetHeight + gap.offsetHeight;
      setTransitionTranslatePx(prev => (prev === travel ? prev : travel));
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(stack);

    return () => {
      ro.disconnect();
    };
  }, [fromIndex, toIndex, fromPaneConfig, toPaneConfig]);

  const overlaySized = stageHeight > 0;

  if (!model || !story || !activeItem) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className={`jgis-story-stage-overlay${
        overlaySized ? ' jgis-story-stage-overlay--sized' : ''
      } jgis-story-stage-overlay--transitioning`}
      style={
        {
          ...spectaPresentationStyle,
          '--jgis-segment-transition-progress': effectiveTransition.progress,
          ...(overlaySized
            ? {
                height: overlayHeight,
                '--jgis-handoff-gap-height': `${stageHeight}px`,
                '--jgis-transition-translate': `${transitionTranslatePx || stageHeight}px`,
              }
            : {}),
        } as React.CSSProperties
      }
    >
      <div ref={stackRef} className="jgis-story-segment-transition-stack">
        <SegmentOverlayPane
          pane="from"
          segmentIndex={fromIndex}
          config={fromPaneConfig}
          storyData={story}
          items={items}
        />
        <div className="jgis-story-segment-transition-gap" aria-hidden />
        <SegmentOverlayPane
          pane="to"
          segmentIndex={toIndex}
          config={toPaneConfig}
          storyData={story}
          items={items}
        />
      </div>
    </div>
  );
}
