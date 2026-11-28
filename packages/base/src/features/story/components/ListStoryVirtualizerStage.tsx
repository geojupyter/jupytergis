import type {
  IJGISLayer,
  IJGISStoryMap,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { useVirtualizer } from '@tanstack/react-virtual';
import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ListStoryMapOverlayPanel } from '@/src/features/story/components/ListStoryMapOverlayPanel';
import { ListStoryOverlayMarkdown } from '@/src/features/story/components/ListStoryOverlayMarkdown';
import { ListStoryTitleBarDesktop } from '@/src/features/story/components/ListStoryTitleBarDesktop';
import { ListStoryTitleBarMobile } from '@/src/features/story/components/ListStoryTitleBarMobile';
import { useStoryMap } from '@/src/features/story/hooks/useStoryMap';
import type {
  IOverrideLayerEntry,
  IStorySegmentViewItem,
} from '@/src/features/story/types/types';
import { activeSegmentIndexAtScroll } from '@/src/features/story/utils/activeSegmentIndexAtScroll';
import {
  isMarkdownOverlayWidthFull,
  resolveCssWidth,
} from '@/src/features/story/utils/cssWidth';
import { getHandoffGapHeight } from '@/src/features/story/utils/getHandoffGapHeight';
import {
  estimateMarkdownHeight,
  getSegmentDisplayMode,
} from '@/src/features/story/utils/listStoryScrollTrack';
import { getSpectaPresentationCssVars } from '@/src/features/story/utils/spectaPresentation';
import {
  getSegmentPaneAlignment,
  segmentPaneAlignment,
} from '@/src/features/story/utils/storySegmentContent';
import {
  buildStorySegmentViewItems,
  getStoryMarkdownFromSlide,
} from '@/src/features/story/utils/storySegmentViewItems';

interface IListStoryVirtualizerStageProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  isMobile: boolean;
  initialLayersReady: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  addLayer: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer: (id: string) => void;
}

interface IListStoryVirtualizerListProps {
  model: IJupyterGISModel;
  isMobile: boolean;
  items: IStorySegmentViewItem[];
  storyData: IJGISStoryMap;
  markdownSegmentGap: boolean;
  currentIndex: number;
  setIndex: (index: number) => void;
  storyRevision: number;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  scrollToIndexRef: React.MutableRefObject<(index: number) => void>;
}

// todo ehhhh dont really like dumb wrappers like this
function isMarkdownSegment(item: IStorySegmentViewItem | undefined): boolean {
  return getSegmentDisplayMode(item?.activeSlide) === 'markdown';
}

function markdownWidthClass(
  isMap: boolean,
  fullWidth: boolean,
  segmentIndex: number,
  items: IStorySegmentViewItem[],
  markdownSegmentGap: boolean,
): string {
  if (isMap || fullWidth || items.length <= 0) {
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

//todo wrapper?
function gapAfter(
  items: IStorySegmentViewItem[],
  index: number,
  viewportHeight: number,
  markdownSegmentGap: boolean,
): number {
  const next = items[index + 1];

  if (!next || viewportHeight <= 0) {
    return 0;
  }

  return getHandoffGapHeight(
    getSegmentDisplayMode(items[index]?.activeSlide),
    getSegmentDisplayMode(next.activeSlide),
    viewportHeight,
    markdownSegmentGap,
  );
}

// todo is this still necessary? reference the Variable (or Pretext?) example in the tanstack docs
function estimateRowSize(
  items: IStorySegmentViewItem[],
  index: number,
  viewportHeight: number,
  markdownSegmentGap: boolean,
): number {
  const item = items[index];
  if (!item || viewportHeight <= 0) {
    return 1;
  }

  const mode = getSegmentDisplayMode(item.activeSlide);
  // todo dont think content is clear name
  const content =
    mode === 'map'
      ? viewportHeight
      : estimateMarkdownHeight(
        getStoryMarkdownFromSlide(item.activeSlide),
        viewportHeight,
      );

  return content + gapAfter(items, index, viewportHeight, markdownSegmentGap);
}

function ListStoryVirtualizerList({
  model,
  isMobile,
  items,
  storyData,
  markdownSegmentGap,
  currentIndex,
  setIndex,
  storyRevision,
  scrollContainerRef,
  scrollToIndexRef,
}: IListStoryVirtualizerListProps): JSX.Element {
  const [viewportHeight, setViewportHeight] = useState(0);

  const contentHeightsRef = useRef(new Map<string, number>());
  const itemsRef = useRef(items);
  const viewportRef = useRef(viewportHeight);
  const gapFlagRef = useRef(markdownSegmentGap);

  itemsRef.current = items;
  viewportRef.current = viewportHeight;
  gapFlagRef.current = markdownSegmentGap;

  const measureElement = useCallback((element: HTMLDivElement) => {
    const index = Number(element.getAttribute('data-index'));
    const item = itemsRef.current[index];
    const spacer = gapAfter(
      itemsRef.current,
      index,
      viewportRef.current,
      gapFlagRef.current,
    );
    const contentEl = element.querySelector('[data-story-row-content]');
    const measured =
      contentEl instanceof HTMLElement ? contentEl.offsetHeight : 0;

    if (!item || getSegmentDisplayMode(item.activeSlide) !== 'markdown') {
      return measured + spacer;
    }

    // Markdown content only grows until the story revision clears this cache.
    //todo do we need revision number? cant edit mid story
    if (measured > 0) {
      const next = Math.max(
        contentHeightsRef.current.get(item.id) ?? 0,
        measured,
      );
      contentHeightsRef.current.set(item.id, next);

      return next + spacer;
    }

    return (contentHeightsRef.current.get(item.id) ?? 0) + spacer;
  }, []);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollContainerRef.current,
    getItemKey: (index) => items[index]?.id ?? index,
    estimateSize: (index) =>
      estimateRowSize(items, index, viewportHeight, markdownSegmentGap),
    overscan: 5,
    measureElement,
  });

  useLayoutEffect(() => {
    // Drop the markdown floor when the story or a layer changes. Remounting
    // would also reset scrollTop, and segment overrides emit layersChanged.
    contentHeightsRef.current.clear();
    virtualizer.measure();
  }, [storyRevision, virtualizer]);

  //todo whats all this
  useLayoutEffect(() => {
    const scroller = scrollContainerRef.current;
    if (!scroller) {
      return;
    }

    const update = (): void => {
      const next = scroller.clientHeight;
      setViewportHeight((prev) => (prev === next ? prev : next));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(scroller);

    return () => observer.disconnect();
  }, [scrollContainerRef]);

  scrollToIndexRef.current = (index: number) => {
    const position = items.findIndex((item) => item.index === index);
    if (position < 0) {
      return;
    }

    //todo the docs have a caveat for this function. do we need to worry?
    virtualizer.scrollToIndex(position, { align: 'start', behavior: 'auto' });
  };

  //todo why are we tracking offset? Shouldnt the library handle that?
  const scrollOffset = virtualizer.scrollOffset ?? 0;
  const totalSize = virtualizer.getTotalSize();

  useLayoutEffect(() => {
    const position = activeSegmentIndexAtScroll(
      scrollOffset,
      virtualizer.measurementsCache,
    );

    const segmentIndex = items[position]?.index;

    if (segmentIndex !== undefined && segmentIndex !== currentIndex) {
      setIndex(segmentIndex);
    }
  }, [scrollOffset, totalSize, virtualizer, items, currentIndex, setIndex]);

  const fullWidth = isMarkdownOverlayWidthFull(storyData.overlayContentWidth);
  const presentationStyle = useMemo(
    () => getSpectaPresentationCssVars(storyData),
    [
      storyData.storyType,
      storyData.overlayContentWidth,
      storyData.markdownSegmentOpacity,
      storyData.storyPanelOpacity,
    ],
  );

  return (
    <div
      ref={scrollContainerRef}
      id="jgis-story-segment-panel"
      className={
        isMobile
          ? 'jgis-story-mobile-list-scroll jgis-story-virtualizer-scroll'
          : 'jgis-story-virtualizer-scroll'
      }
      style={presentationStyle}
      data-testid="jgis-story-stage-scroll-host"
    >
      {items.length === 0 ? (
        <div style={{ padding: '1rem' }}>No segments.</div>
      ) : (
        <div
          style={{
            height: totalSize,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = items[virtualRow.index];
            if (!item) {
              return null;
            }

            const mode = getSegmentDisplayMode(item.activeSlide);
            const isMap = mode === 'map';
            const alignSelf = segmentPaneAlignment(
              //todo legacy shit. do we care?
              getSegmentPaneAlignment(item.activeSlide?.content, mode),
            );
            const spacer = gapAfter(
              items,
              virtualRow.index,
              viewportHeight,
              markdownSegmentGap,
            );

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  //todo why the transform
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  data-story-row-content
                  //todo would rather have full classnames in the ternary so they're searchable
                  className={`jgis-story-segment-overlay-pane jgis-story-${isMap ? 'map' : 'markdown'
                    }-scroll-pane${markdownWidthClass(
                      isMap,
                      fullWidth,
                      item.index,
                      items,
                      markdownSegmentGap,
                    )}`}
                  style={{
                    position: 'relative',
                    width: '100%',
                    alignSelf,
                    ...(isMap
                      ? {
                        height: viewportHeight,
                        maxHeight: viewportHeight,
                        alignItems: alignSelf,
                      }
                      : { height: 'auto', maxHeight: 'none' }),
                  }}
                >
                  {/* //todo use a registry? */}
                  {isMap ? (
                    <ListStoryMapOverlayPanel
                      model={model}
                      storyData={storyData}
                      segmentIndex={item.index}
                      items={items}
                      panelWidth={resolveCssWidth(
                        item.activeSlide?.content?.panelWidth,
                      )}
                      isMobile={isMobile}
                    />
                  ) : (
                    <ListStoryOverlayMarkdown
                      model={model}
                      segmentId={item.id}
                      source={getStoryMarkdownFromSlide(item.activeSlide)}
                    />
                  )}
                </div>
                {spacer > 0 ? (
                  <div
                    aria-hidden
                    style={{ height: spacer, width: '100%' }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ListStoryVirtualizerStage({
  model,
  isSpecta,
  isMobile,
  initialLayersReady,
  scrollContainerRef,
  addLayer,
  removeLayer,
}: IListStoryVirtualizerStageProps): JSX.Element {
  //todo revision again
  const [storyRevision, setStoryRevision] = useState(0);
  const overrideLayerEntriesRef = useRef<IOverrideLayerEntry[]>([]);
  const scrollToIndexRef = useRef<(index: number) => void>(() => undefined);

  useLayoutEffect(() => {
    const bump = (): void => {
      setStoryRevision((value) => value + 1);
    };

    model.sharedModel.storyMapsChanged.connect(bump);
    model.sharedModel.layersChanged.connect(bump);

    return () => {
      model.sharedModel.storyMapsChanged.disconnect(bump);
      model.sharedModel.layersChanged.disconnect(bump);
    };
  }, [model]);

  const { currentIndex, setIndex } = useStoryMap({
    model,
    overrideLayerEntriesRef,
    removeLayer,
    addLayer,
    isSpecta,
  });

  const items = useMemo(
    () =>
      buildStorySegmentViewItems(model, model.getSelectedStory().story ?? null),
    [model, storyRevision],
  );

  const storyData = model.getSelectedStory().story;
  const markdownSegmentGap = storyData?.markdownSegmentGap === true;

  const onSegmentClick = useCallback((index: number) => {
    scrollToIndexRef.current(index);
  }, []);

  const titleBarProps = {
    segmentItems: items,
    currentIndex,
    onSegmentClick,
  };

  return (
    <>
      {/* //todo  I LOVE REGISTRIES NOW */}
      {isMobile ? (
        <ListStoryTitleBarMobile {...titleBarProps} />
      ) : (
        <ListStoryTitleBarDesktop {...titleBarProps} />
      )}
      {initialLayersReady && storyData ? (
        <ListStoryVirtualizerList
          model={model}
          isMobile={isMobile}
          items={items}
          storyData={storyData}
          markdownSegmentGap={markdownSegmentGap}
          currentIndex={currentIndex}
          setIndex={setIndex}
          storyRevision={storyRevision}
          scrollContainerRef={scrollContainerRef}
          scrollToIndexRef={scrollToIndexRef}
        />
      ) : null}
    </>
  );
}
