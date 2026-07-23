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
  IStorySegmentViewItem,
} from '@/src/features/story/types/types';
import { isIntraSegmentScroll } from '@/src/features/story/utils/computeListStoryScrollState';
import { getHandoffGapHeight } from '@/src/features/story/utils/getHandoffGapHeight';
import {
  getScrollTrackSegmentHeight,
  getSegmentDisplayMode,
} from '@/src/features/story/utils/listStoryScrollTrack';
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
  | { type: 'markdown'; markdown: string; segmentId: string }
  | { type: 'map'; segmentIndex: number };

type OverlayPaneRole = 'from' | 'to' | 'lookahead';

const EMPTY_MARKDOWN_PANE: SegmentOverlayPaneConfig = {
  type: 'markdown',
  markdown: '',
  segmentId: '',
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
  if (mode === 'map') {
    return { type: 'map', segmentIndex: item.index };
  }
  return {
    type: 'markdown',
    markdown: getStoryMarkdownFromSlide(item.activeSlide),
    segmentId: item.id,
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
    return prev.segmentIndex === next.segmentIndex;
  }

  if (prev.type === 'markdown' && next.type === 'markdown') {
    return prev.segmentId === next.segmentId && prev.markdown === next.markdown;
  }

  return false;
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
    onMarkdownRendered,
    onPaneUnmount,
  }: ISegmentOverlayPaneProps): React.ReactElement => {
    const isMap = config.type === 'map';

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
        }-scroll-pane`}
      >
        {isMap ? (
          <ListStoryMapOverlayPanel
            model={model}
            storyData={storyData}
            segmentIndex={config.segmentIndex}
            items={items}
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
}: IListStoryStageOverlayProps): JSX.Element | null {
  const overlayRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const markdownRenderedRef = useRef<Set<number>>(new Set());
  const imageWaitCancelRef = useRef<(() => void) | null>(null);
  const measureTransitionRef = useRef<(() => void) | null>(null);
  const measuredTransitionKeyRef = useRef('');
  const measureTransitionKeyRef = useRef('');
  const stableTravelRef = useRef(0);
  const clearMarkdownRendered = useCallback((segmentIndex: number): void => {
    markdownRenderedRef.current.delete(segmentIndex);
  }, []);
  const [stageHeight, setStageHeight] = useState(0);
  const [transitionTranslatePx, setTransitionTranslatePx] = useState(0);
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
  const toStackPane = overlayStack.panes.find(pane => pane.role === 'to');
  const lookaheadStackPane = overlayStack.panes.find(
    pane => pane.role === 'lookahead',
  );

  const overlayHeight = Math.max(stageHeight, 0);
  const transitionProgress = transition?.progress ?? 0;
  const fromIndex = fromStackPane?.segmentIndex ?? currentIndex;
  const toIndex = toStackPane?.segmentIndex ?? fromIndex;

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
          measureTransitionRef.current?.();
        });
      }

      if (segmentIndex === fromIndex) {
        measureTransitionRef.current?.();
      }
    },
    [fromIndex, overlayStack.panes, reportSegmentHeight],
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
    };
  }, [overlayStack.panes, reportSegmentHeight]);

  useLayoutEffect(() => {
    const stack = stackRef.current;
    if (!stack || !transition || !fromStackPane) {
      return;
    }

    const fromPaneIsMarkdown =
      fromStackPane.config.type === 'markdown' &&
      Boolean(fromStackPane.config.markdown);

    const transitionKey = intraSegmentScroll
      ? `intra:${fromIndex}`
      : `handoff:${fromIndex}:${toIndex}:${transition.fromMode}:${transition.toMode}`;

    if (measureTransitionKeyRef.current !== transitionKey) {
      measureTransitionKeyRef.current = transitionKey;
      measuredTransitionKeyRef.current = '';
      stableTravelRef.current = 0;
      setTransitionTranslatePx(0);
    }

    const measure = (): void => {
      const fromPane = stack.querySelector('[data-pane="from"]');

      if (!(fromPane instanceof HTMLElement)) {
        return;
      }

      const gapHeight = overlayStack.includeGap ? handoffGapHeight : 0;
      const rawTravel = fromPane.offsetHeight + gapHeight;
      const fromReady =
        !fromPaneIsMarkdown ||
        markdownRenderedRef.current.has(fromStackPane.segmentIndex);

      if (fromReady && rawTravel > 0) {
        stableTravelRef.current = Math.max(stableTravelRef.current, rawTravel);
      }
      const travel = stableTravelRef.current;

      if (!fromReady) {
        return;
      }

      measuredTransitionKeyRef.current = transitionKey;
      setTransitionTranslatePx(prev => (prev === travel ? prev : travel));
    };

    measureTransitionRef.current = measure;
    measure();

    const fromPane = stack.querySelector('[data-pane="from"]');
    if (!(fromPane instanceof HTMLElement)) {
      return;
    }

    const ro = new ResizeObserver(() => {
      if (
        !fromPaneIsMarkdown ||
        markdownRenderedRef.current.has(fromStackPane.segmentIndex)
      ) {
        measure();
      }
    });
    ro.observe(fromPane);

    return () => {
      ro.disconnect();
      imageWaitCancelRef.current?.();
      imageWaitCancelRef.current = null;
    };
  }, [
    transition,
    fromStackPane,
    toStackPane,
    lookaheadStackPane,
    overlayStack.includeGap,
    intraSegmentScroll,
    fromIndex,
    toIndex,
    handoffGapHeight,
  ]);

  useLayoutEffect(() => {
    measureTransitionRef.current?.();
  }, [stageHeight]);

  const overlaySized = stageHeight > 0;
  const currentTransitionKey = intraSegmentScroll
    ? `intra:${fromIndex}`
    : `handoff:${fromIndex}:${toIndex}:${transition?.fromMode ?? ''}:${transition?.toMode ?? ''}`;

  const scrollFromHeight = getScrollTrackSegmentHeight(
    scrollTrackLayout,
    fromIndex,
  );
  const fromTrackSegment = scrollTrackLayout?.segments.find(
    segment => segment.index === fromIndex,
  );

  const isMdToMdNoGap =
    !intraSegmentScroll &&
    handoffGapHeight === 0 &&
    transition?.fromMode === 'markdown' &&
    transition?.toMode === 'markdown';

  const translateIsCurrent =
    measuredTransitionKeyRef.current === currentTransitionKey &&
    transitionTranslatePx > 0;

  // Pixel travel for progress 0->1 (`--jgis-transition-translate`).
  //
  // Md->md with no gap: scroll progress is computed from the virtual track, so
  // prefer the track's from-segment height once measured. Until then, use the
  // live DOM measure if ready, else use the track estimate.
  //
  // All other transitions: use the live DOM measure when it matches this
  // transition, gap handoffs fall back to stageHeight, otherwise 0.
  const effectiveTranslatePx = isMdToMdNoGap
    ? fromTrackSegment?.measured && scrollFromHeight
      ? scrollFromHeight
      : translateIsCurrent
        ? transitionTranslatePx
        : (scrollFromHeight ?? 0)
    : translateIsCurrent
      ? transitionTranslatePx
      : handoffGapHeight > 0
        ? stageHeight
        : 0;

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
                '--jgis-transition-translate': `${effectiveTranslatePx}px`,
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
