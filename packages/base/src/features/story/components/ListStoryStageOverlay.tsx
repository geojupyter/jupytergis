import { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ListStoryMapOverlayPanel } from '@/src/features/story/components/ListStoryMapOverlayPanel';
import { ListStoryOverlayMarkdown } from '@/src/features/story/components/ListStoryOverlayMarkdown';
import { useCurrentSegmentIndex } from '@/src/features/story/hooks/useCurrentSegmentIndex';
import type {
  IListStorySegmentTransition,
  StorySegmentDisplayMode,
  IStorySegmentViewItem,
} from '@/src/features/story/types/types';
import { isIntraSegmentScroll } from '@/src/features/story/utils/computeListStoryScrollState';
import { getSegmentDisplayMode } from '@/src/features/story/utils/listStoryScrollTrack';
import { getSpectaPresentationCssVars } from '@/src/features/story/utils/spectaPresentation';
import {
  buildStorySegmentViewItems,
  getStoryMarkdownFromSlide,
} from '@/src/features/story/utils/storySegmentViewItems';
import { whenImagesSettled } from '@/src/features/story/utils/whenImagesSettled';

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
  onMarkdownRendered?: () => void;
}

function SegmentOverlayPane({
  pane,
  segmentIndex,
  config,
  storyData,
  items,
  onMarkdownRendered,
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
          onRendered={onMarkdownRendered}
        />
      ) : null}
    </div>
  );
}

function buildFallbackTransition(
  activeItem: IStorySegmentViewItem,
): IListStorySegmentTransition {
  const mode = getSegmentDisplayMode(activeItem.activeSlide);
  return {
    progress: 0,
    fromIndex: activeItem.index,
    toIndex: activeItem.index,
    fromMode: mode,
    toMode: mode,
  };
}

/**
 * List-story stage overlay: map + markdown segments on the map stage.
 */
export function ListStoryStageOverlay({
  model,
  segmentTransition,
}: IListStoryStageOverlayProps): JSX.Element | null {
  const overlayRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const fromMarkdownRenderedRef = useRef(false);
  const imageWaitCancelRef = useRef<(() => void) | null>(null);
  const measureTransitionRef = useRef<(() => void) | null>(null);
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

  const activeItem = items.find(item => item.index === currentIndex);

  const transition = useMemo((): IListStorySegmentTransition | null => {
    if (segmentTransition) {
      return segmentTransition;
    }

    if (activeItem) {
      return buildFallbackTransition(activeItem);
    }

    return null;
  }, [segmentTransition, activeItem]);

  const intraSegmentScroll = isIntraSegmentScroll(transition);

  const { fromIndex, toIndex, fromPaneConfig, toPaneConfig } = useMemo(() => {
    if (!model || !transition) {
      return {
        fromIndex: currentIndex,
        toIndex: currentIndex,
        fromPaneConfig: EMPTY_MARKDOWN_PANE,
        toPaneConfig: EMPTY_MARKDOWN_PANE,
      };
    }

    const fromItem = items.find(item => item.index === transition.fromIndex);
    const toItem = items.find(item => item.index === transition.toIndex);

    const fromPaneConfig = buildPaneConfig(fromItem, transition.fromMode);
    const toPaneConfig = intraSegmentScroll
      ? EMPTY_MARKDOWN_PANE
      : buildPaneConfig(toItem, transition.toMode);

    const paneState = {
      fromIndex: transition.fromIndex,
      toIndex: transition.toIndex,
      fromPaneConfig,
      toPaneConfig,
    };

    return paneState;
  }, [items, currentIndex, transition, intraSegmentScroll, model]);

  const overlayHeight = Math.max(stageHeight, 0);
  const transitionProgress = transition?.progress ?? 0;

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

  const handleFromMarkdownRendered = useCallback((): void => {
    fromMarkdownRenderedRef.current = true;
    measureTransitionRef.current?.();

    const stack = stackRef.current;
    const fromPane = stack?.querySelector('[data-pane="from"]');
    if (!(fromPane instanceof HTMLElement)) {
      return;
    }

    imageWaitCancelRef.current?.();
    imageWaitCancelRef.current = whenImagesSettled(fromPane, () => {
      imageWaitCancelRef.current = null;
      measureTransitionRef.current?.();
    });
  }, []);

  useLayoutEffect(() => {
    const stack = stackRef.current;
    if (!stack) {
      return;
    }

    const fromPaneIsMarkdown =
      fromPaneConfig.type === 'markdown' && Boolean(fromPaneConfig.markdown);
    fromMarkdownRenderedRef.current = !fromPaneIsMarkdown;
    imageWaitCancelRef.current?.();
    imageWaitCancelRef.current = null;

    const measure = (): void => {
      const fromPane = stack.querySelector('[data-pane="from"]');

      if (!(fromPane instanceof HTMLElement)) {
        return;
      }

      const gap = stack.querySelector('.jgis-story-segment-transition-gap');
      const gapHeight =
        gap instanceof HTMLElement && !intraSegmentScroll
          ? gap.offsetHeight
          : 0;

      const travel = fromPane.offsetHeight + gapHeight;
      setTransitionTranslatePx(prev => (prev === travel ? prev : travel));
    };

    measureTransitionRef.current = measure;
    measure();

    const fromPane = stack.querySelector('[data-pane="from"]');
    if (!(fromPane instanceof HTMLElement)) {
      return;
    }

    const ro = new ResizeObserver(() => {
      if (!fromPaneIsMarkdown || fromMarkdownRenderedRef.current) {
        measure();
      }
    });
    ro.observe(fromPane);

    return () => {
      ro.disconnect();
      imageWaitCancelRef.current?.();
      imageWaitCancelRef.current = null;
    };
  }, [fromIndex, toIndex, fromPaneConfig, toPaneConfig, intraSegmentScroll]);

  const overlaySized = stageHeight > 0;

  if (!model || !story || !activeItem || !transition) {
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
          '--jgis-segment-transition-progress': transitionProgress,
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
          onMarkdownRendered={
            fromPaneConfig.type === 'markdown' && fromPaneConfig.markdown
              ? handleFromMarkdownRendered
              : undefined
          }
        />
        {!intraSegmentScroll ? (
          <>
            <div className="jgis-story-segment-transition-gap" aria-hidden />
            <SegmentOverlayPane
              pane="to"
              segmentIndex={toIndex}
              config={toPaneConfig}
              storyData={story}
              items={items}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
