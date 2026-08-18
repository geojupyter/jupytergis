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
import { useListStoryScrollTrackContext } from '@/src/features/story/context/ListStoryScrollTrackContext';
import { useCurrentSegmentIndex } from '@/src/features/story/hooks/useCurrentSegmentIndex';
import type {
  IListStorySegmentTransition,
  StorySegmentDisplayMode,
  StorySegmentPaneAlignment,
  IStorySegmentViewItem,
} from '@/src/features/story/types/types';
import { isIntraSegmentScroll } from '@/src/features/story/utils/computeListStoryScrollState';
import { getHandoffGapHeight } from '@/src/features/story/utils/getHandoffGapHeight';
import {
  getSegmentDisplayMode,
  getTransitionTranslatePx,
} from '@/src/features/story/utils/listStoryScrollTrack';
import {
  getSpectaPresentationCssVars,
  isOverlayContentWidthFull,
} from '@/src/features/story/utils/spectaPresentation';
import {
  getSegmentPaneAlignment,
  resolveSegmentPanelWidth,
  segmentPaneAlignment,
} from '@/src/features/story/utils/storySegmentContent';
import {
  buildStorySegmentViewItems,
  getStoryMarkdownFromSlide,
} from '@/src/features/story/utils/storySegmentViewItems';
import { whenImagesSettled } from '@/src/features/story/utils/whenImagesSettled';

interface IListStoryStageOverlayProps {
  model: IJupyterGISModel;
  segmentTransition: IListStorySegmentTransition | null;
  isMobile: boolean;
}

type SegmentOverlayPaneConfig =
  | {
      type: 'markdown';
      markdown: string;
      segmentId: string;
      paneAlignment: StorySegmentPaneAlignment;
    }
  | {
      type: 'map';
      segmentIndex: number;
      paneAlignment: StorySegmentPaneAlignment;
      panelWidth?: string;
    };

type OverlayPaneRole = 'from' | 'to' | 'lookahead';

const EMPTY_MARKDOWN_PANE: SegmentOverlayPaneConfig = {
  type: 'markdown',
  markdown: '',
  segmentId: '',
  paneAlignment: 'center',
};

interface IOverlayStackPane {
  role: OverlayPaneRole;
  segmentIndex: number;
  mode: StorySegmentDisplayMode;
  config: SegmentOverlayPaneConfig;
}

interface IOverlayStack {
  panes: IOverlayStackPane[];
  includeGap: boolean;
}

function buildPaneConfig(
  item: IStorySegmentViewItem | undefined,
  mode: StorySegmentDisplayMode,
): SegmentOverlayPaneConfig {
  if (!item) {
    return EMPTY_MARKDOWN_PANE;
  }

  const paneAlignment = getSegmentPaneAlignment(
    item.activeSlide?.content,
    mode,
  );

  if (mode === 'map') {
    return {
      type: 'map',
      segmentIndex: item.index,
      paneAlignment,
      panelWidth: resolveSegmentPanelWidth(item.activeSlide?.content),
    };
  }

  return {
    type: 'markdown',
    markdown: getStoryMarkdownFromSlide(item.activeSlide),
    segmentId: item.id,
    paneAlignment,
  };
}

function getMarkdownLookaheadIndex(
  items: IStorySegmentViewItem[],
  afterIndex: number,
  markdownSegmentGap: boolean,
): number | null {
  if (markdownSegmentGap) {
    return null;
  }

  const current = items.find(item => item.index === afterIndex);
  const next = items.find(item => item.index === afterIndex + 1);
  if (!current || !next) {
    return null;
  }

  if (
    getSegmentDisplayMode(current.activeSlide) === 'markdown' &&
    getSegmentDisplayMode(next.activeSlide) === 'markdown'
  ) {
    return next.index;
  }

  return null;
}

function buildOverlayStack({
  transition,
  intraSegmentScroll,
  items,
  handoffGapHeight,
  markdownSegmentGap,
}: {
  transition: IListStorySegmentTransition;
  intraSegmentScroll: boolean;
  items: IStorySegmentViewItem[];
  handoffGapHeight: number;
  markdownSegmentGap: boolean;
}): IOverlayStack {
  const fromItem = items.find(item => item.index === transition.fromIndex);

  const fromPane: IOverlayStackPane = {
    role: 'from',
    segmentIndex: transition.fromIndex,
    mode: transition.fromMode,
    config: buildPaneConfig(fromItem, transition.fromMode),
  };

  if (intraSegmentScroll) {
    const panes = [fromPane];
    const lookaheadIndex = getMarkdownLookaheadIndex(
      items,
      transition.fromIndex,
      markdownSegmentGap,
    );

    if (lookaheadIndex !== null) {
      const lookaheadItem = items.find(item => item.index === lookaheadIndex);
      panes.push({
        role: 'lookahead',
        segmentIndex: lookaheadIndex,
        mode: 'markdown',
        config: buildPaneConfig(lookaheadItem, 'markdown'),
      });
    }

    return { panes, includeGap: false };
  }

  const toItem = items.find(item => item.index === transition.toIndex);
  const panes: IOverlayStackPane[] = [
    fromPane,
    {
      role: 'to',
      segmentIndex: transition.toIndex,
      mode: transition.toMode,
      config: buildPaneConfig(toItem, transition.toMode),
    },
  ];

  const lookaheadIndex = getMarkdownLookaheadIndex(
    items,
    transition.toIndex,
    markdownSegmentGap,
  );

  if (lookaheadIndex !== null) {
    const lookaheadItem = items.find(item => item.index === lookaheadIndex);
    panes.push({
      role: 'lookahead',
      segmentIndex: lookaheadIndex,
      mode: 'markdown',
      config: buildPaneConfig(lookaheadItem, 'markdown'),
    });
  }

  return { panes, includeGap: handoffGapHeight > 0 };
}

interface ISegmentOverlayPaneProps {
  pane: OverlayPaneRole;
  segmentIndex: number;
  config: SegmentOverlayPaneConfig;
  model: IJupyterGISModel;
  storyData: IJGISStoryMap;
  items: IStorySegmentViewItem[];
  isMobile: boolean;
  isOverlayContentWidthFull: boolean;
  onMarkdownRendered: (segmentIndex: number) => void;
  onPaneUnmount: (segmentIndex: number) => void;
}

function segmentConfigsEqual(
  prev: SegmentOverlayPaneConfig,
  next: SegmentOverlayPaneConfig,
): boolean {
  if (prev.type !== next.type) {
    return false;
  }

  if (prev.type === 'map' && next.type === 'map') {
    return (
      prev.segmentIndex === next.segmentIndex &&
      prev.paneAlignment === next.paneAlignment &&
      prev.panelWidth === next.panelWidth
    );
  }

  if (prev.type === 'markdown' && next.type === 'markdown') {
    return (
      prev.segmentId === next.segmentId &&
      prev.markdown === next.markdown &&
      prev.paneAlignment === next.paneAlignment
    );
  }

  return false;
}

function isMarkdownSegment(item: IStorySegmentViewItem | undefined): boolean {
  return getSegmentDisplayMode(item?.activeSlide) === 'markdown';
}

function getMarkdownConstrainedWidthClass(
  isMap: boolean,
  isOverlayContentWidthFull: boolean,
  segmentIndex: number,
  items: IStorySegmentViewItem[],
  markdownSegmentGap: boolean,
): string {
  if (isMap || isOverlayContentWidthFull || items.length <= 0) {
    return '';
  }

  const joinsPrevious =
    !markdownSegmentGap && isMarkdownSegment(items[segmentIndex - 1]);
  const joinsNext =
    !markdownSegmentGap && isMarkdownSegment(items[segmentIndex + 1]);
  const roundTop = segmentIndex !== 0 && !joinsPrevious;
  const roundBottom = segmentIndex !== items.length - 1 && !joinsNext;

  if (roundTop && roundBottom) {
    return ' jgis-story-markdown-scroll-pane--constrained-width';
  }

  if (roundBottom) {
    return ' jgis-story-markdown-scroll-pane--constrained-width-bottom';
  }

  if (roundTop) {
    return ' jgis-story-markdown-scroll-pane--constrained-width-top';
  }

  return '';
}

function segmentOverlayPanePropsAreEqual(
  prev: ISegmentOverlayPaneProps,
  next: ISegmentOverlayPaneProps,
): boolean {
  return (
    prev.pane === next.pane &&
    prev.segmentIndex === next.segmentIndex &&
    prev.model === next.model &&
    prev.storyData === next.storyData &&
    prev.items === next.items &&
    prev.isOverlayContentWidthFull === next.isOverlayContentWidthFull &&
    prev.isMobile === next.isMobile &&
    segmentConfigsEqual(prev.config, next.config)
  );
}

const SegmentOverlayPane = React.memo(
  ({
    pane,
    segmentIndex,
    config,
    model,
    storyData,
    items,
    isMobile,
    isOverlayContentWidthFull,
    onMarkdownRendered,
    onPaneUnmount,
  }: ISegmentOverlayPaneProps): React.ReactElement => {
    const isMap = config.type === 'map';
    const alignSelf = segmentPaneAlignment(config.paneAlignment);
    const markdownConstrainedWidthClass = getMarkdownConstrainedWidthClass(
      isMap,
      isOverlayContentWidthFull,
      segmentIndex,
      items,
      storyData.markdownSegmentGap === true,
    );

    useLayoutEffect(() => {
      return () => {
        onPaneUnmount(segmentIndex);
      };
    }, [segmentIndex, onPaneUnmount]);

    return (
      <div
        data-pane={pane}
        data-segment-index={segmentIndex}
        className={`jgis-story-segment-overlay-pane jgis-story-${
          isMap ? 'map' : 'markdown'
        }-scroll-pane${markdownConstrainedWidthClass}`}
        style={{
          alignSelf,
          ...(isMap ? { alignItems: alignSelf } : undefined),
        }}
      >
        {isMap ? (
          <ListStoryMapOverlayPanel
            model={model}
            storyData={storyData}
            segmentIndex={config.segmentIndex}
            items={items}
            panelWidth={config.panelWidth}
            isMobile={isMobile}
          />
        ) : config.markdown ? (
          <ListStoryOverlayMarkdown
            model={model}
            segmentId={config.segmentId}
            source={config.markdown}
            onRendered={() => onMarkdownRendered(segmentIndex)}
          />
        ) : null}
      </div>
    );
  },
  segmentOverlayPanePropsAreEqual,
);

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
  isMobile,
}: IListStoryStageOverlayProps): JSX.Element | null {
  const overlayRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const markdownRenderedRef = useRef<Set<number>>(new Set());
  const imageWaitCancelRef = useRef<(() => void) | null>(null);
  const clearMarkdownRendered = useCallback((segmentIndex: number): void => {
    markdownRenderedRef.current.delete(segmentIndex);
  }, []);
  const [stageHeight, setStageHeight] = useState(0);
  const currentIndex = useCurrentSegmentIndex(model);
  const { scrollTrackLayout, reportSegmentHeight } =
    useListStoryScrollTrackContext();

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
      story?.overlayContentWidth,
      story?.markdownSegmentOpacity,
      story?.storyPanelOpacity,
    ],
  );

  const overlayContentWidthFull = isOverlayContentWidthFull(
    story?.overlayContentWidth,
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
  const markdownSegmentGap = story?.markdownSegmentGap === true;

  const handoffGapHeight = useMemo((): number => {
    if (!transition || intraSegmentScroll || stageHeight <= 0) {
      return 0;
    }

    return getHandoffGapHeight(
      transition.fromMode,
      transition.toMode,
      stageHeight,
      markdownSegmentGap,
    );
  }, [transition, intraSegmentScroll, stageHeight, markdownSegmentGap]);

  const overlayStack = useMemo((): IOverlayStack => {
    if (!transition) {
      return { panes: [], includeGap: false };
    }

    return buildOverlayStack({
      transition,
      intraSegmentScroll,
      items,
      handoffGapHeight,
      markdownSegmentGap,
    });
  }, [
    transition,
    intraSegmentScroll,
    items,
    handoffGapHeight,
    markdownSegmentGap,
  ]);

  const fromStackPane = overlayStack.panes.find(pane => pane.role === 'from');

  const overlayHeight = Math.max(stageHeight, 0);
  const transitionProgress = transition?.progress ?? 0;
  const transitionTranslatePx = getTransitionTranslatePx(
    transition,
    scrollTrackLayout,
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

  const handleMarkdownRendered = useCallback(
    (segmentIndex: number): void => {
      markdownRenderedRef.current.add(segmentIndex);

      const stack = stackRef.current;
      const paneEl = stack?.querySelector(
        `[data-segment-index="${segmentIndex}"]`,
      );

      if (paneEl instanceof HTMLElement) {
        const stackPane = overlayStack.panes.find(
          p => p.segmentIndex === segmentIndex,
        );

        const segmentId =
          stackPane?.config.type === 'markdown'
            ? stackPane.config.segmentId
            : undefined;

        const reportPaneHeight = (): void => {
          if (segmentId) {
            reportSegmentHeight(segmentId, paneEl.offsetHeight);
          }
        };

        reportPaneHeight();

        imageWaitCancelRef.current?.();
        imageWaitCancelRef.current = whenImagesSettled(paneEl, () => {
          imageWaitCancelRef.current = null;
          reportPaneHeight();
        });
      }
    },
    [overlayStack.panes, reportSegmentHeight],
  );

  useLayoutEffect(() => {
    const stack = stackRef.current;
    if (!stack) {
      return;
    }

    const reportVisibleMarkdownHeights = (): void => {
      for (const stackPane of overlayStack.panes) {
        if (
          stackPane.config.type !== 'markdown' ||
          !stackPane.config.segmentId
        ) {
          continue;
        }

        if (!markdownRenderedRef.current.has(stackPane.segmentIndex)) {
          continue;
        }

        const paneEl = stack.querySelector(
          `[data-segment-index="${stackPane.segmentIndex}"]`,
        );

        if (!(paneEl instanceof HTMLElement) || paneEl.offsetHeight <= 0) {
          continue;
        }

        reportSegmentHeight(stackPane.config.segmentId, paneEl.offsetHeight);
      }
    };

    reportVisibleMarkdownHeights();

    const ro = new ResizeObserver(() => {
      reportVisibleMarkdownHeights();
    });

    for (const stackPane of overlayStack.panes) {
      if (stackPane.config.type !== 'markdown') {
        continue;
      }

      const paneEl = stack.querySelector(
        `[data-segment-index="${stackPane.segmentIndex}"]`,
      );

      if (paneEl instanceof HTMLElement) {
        ro.observe(paneEl);
      }
    }

    return () => {
      ro.disconnect();
      imageWaitCancelRef.current?.();
      imageWaitCancelRef.current = null;
    };
  }, [overlayStack.panes, reportSegmentHeight]);

  const overlaySized = stageHeight > 0;

  if (!model || !story || !activeItem || !transition || !fromStackPane) {
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
                '--jgis-transition-translate': `${transitionTranslatePx}px`,
              }
            : {}),
        } as React.CSSProperties
      }
    >
      <div ref={stackRef} className="jgis-story-segment-transition-stack">
        {overlayStack.panes.flatMap((stackPane, paneOrder) => {
          const nodes: React.ReactNode[] = [];

          if (paneOrder === 1 && overlayStack.includeGap) {
            nodes.push(
              <div
                key="handoff-gap"
                className="jgis-story-segment-transition-gap"
                aria-hidden
              />,
            );
          }
          nodes.push(
            <SegmentOverlayPane
              key={stackPane.segmentIndex}
              model={model}
              pane={stackPane.role}
              segmentIndex={stackPane.segmentIndex}
              config={stackPane.config}
              storyData={story}
              items={items}
              isMobile={isMobile}
              isOverlayContentWidthFull={overlayContentWidthFull}
              onMarkdownRendered={handleMarkdownRendered}
              onPaneUnmount={clearMarkdownRendered}
            />,
          );
          return nodes;
        })}
      </div>
    </div>
  );
}
