import type { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ListStoryMarkdownMeasurePane } from '@/src/features/story/components/ListStoryMarkdownMeasurePane';
import { useCurrentSegmentIndex } from '@/src/features/story/hooks/useCurrentSegmentIndex';
import { useQueuedMarkdownHeightMeasure } from '@/src/features/story/hooks/useQueuedMarkdownHeightMeasure';
import type { IListStoryScrollTrackLayout } from '@/src/features/story/types/types';
import { buildListStoryScrollTrack } from '@/src/features/story/utils/listStoryScrollTrack';
import {
  buildStorySegmentViewItems,
  getListStoryMarkdownSegmentsFromItems,
} from '@/src/features/story/utils/storySegmentViewItems';

interface IListStoryScrollTrackContextValue {
  scrollTrackLayout: IListStoryScrollTrackLayout | null;
  scrollTop: number;
  bindScrollTrackElement: (element: HTMLDivElement | null) => void;
  scrollToSegmentIndex: (
    index: number,
    options?: { behavior?: ScrollBehavior },
  ) => void;
}

const ListStoryScrollTrackContext =
  createContext<IListStoryScrollTrackContextValue | null>(null);

interface IListStoryScrollTrackProviderProps {
  model: IJupyterGISModel;
  enabled: boolean;
  children: React.ReactNode;
}

export function ListStoryScrollTrackProvider({
  model,
  enabled,
  children,
}: IListStoryScrollTrackProviderProps): JSX.Element {
  const [storyRevision, setStoryRevision] = useState(0);
  const [heightsById, setHeightsById] = useState<Record<string, number>>({});
  const [viewportHeight, setViewportHeight] = useState(0);
  const [mapViewportHeight, setMapViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const currentSegmentIndex = useCurrentSegmentIndex(model);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTrackElement, setScrollTrackElement] =
    useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const bump = (): void => {
      setStoryRevision(value => value + 1);
      setHeightsById({});
    };

    model.sharedModel.storyMapsChanged.connect(bump);
    model.sharedModel.layersChanged.connect(bump);

    return () => {
      model.sharedModel.storyMapsChanged.disconnect(bump);
      model.sharedModel.layersChanged.disconnect(bump);
    };
  }, [model]);

  const storyData = useMemo((): IJGISStoryMap | null => {
    return model.getSelectedStory().story ?? null;
  }, [model, storyRevision]);

  const items = useMemo(
    () => buildStorySegmentViewItems(model, storyData),
    [model, storyData],
  );

  const markdownSegments = useMemo(
    () => getListStoryMarkdownSegmentsFromItems(items),
    [items],
  );

  const mapViewportHeightOption =
    mapViewportHeight > 0 ? mapViewportHeight : undefined;

  const buildScrollTrackLayout = useCallback(
    (
      nextHeightsById: Readonly<Record<string, number>>,
    ): IListStoryScrollTrackLayout | null =>
      buildListStoryScrollTrack({
        items,
        viewportHeight,
        mapViewportHeight: mapViewportHeightOption,
        heightsById: nextHeightsById,
      }),
    [items, viewportHeight, mapViewportHeightOption],
  );

  const syncScrollerMetrics = useCallback((scroller: HTMLDivElement): void => {
    setViewportHeight(scroller.clientHeight);
    setScrollTop(scroller.scrollTop);
  }, []);

  const bindScrollTrackElement = useCallback(
    (element: HTMLDivElement | null) => {
      scrollerRef.current = element;
      setScrollTrackElement(element);
      if (!element) {
        setViewportHeight(0);
        setScrollTop(0);
        return;
      }

      syncScrollerMetrics(element);
    },
    [syncScrollerMetrics],
  );

  const observeElementHeight = useCallback(
    (
      element: HTMLElement,
      update: () => void,
      options?: { callImmediately?: boolean },
    ): (() => void) => {
      if (options?.callImmediately) {
        update();
      }

      const ro = new ResizeObserver(update);
      ro.observe(element);

      return () => {
        ro.disconnect();
      };
    },
    [],
  );

  useLayoutEffect(() => {
    const scroller = scrollTrackElement;
    if (!scroller || !enabled) {
      return;
    }

    const update = (): void => {
      syncScrollerMetrics(scroller);
    };

    return observeElementHeight(scroller, update);
  }, [enabled, scrollTrackElement, observeElementHeight, syncScrollerMetrics]);

  useLayoutEffect(() => {
    const scroller = scrollTrackElement;
    if (!scroller || !enabled) {
      return;
    }

    const onScroll = (): void => {
      setScrollTop(scroller.scrollTop);
      setViewportHeight(scroller.clientHeight);
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      scroller.removeEventListener('scroll', onScroll);
    };
  }, [enabled, scrollTrackElement]);

  useLayoutEffect(() => {
    if (!enabled) {
      setMapViewportHeight(0);
      return;
    }

    const container = document.querySelector('.jGIS-Mainview-Container');
    if (!(container instanceof HTMLElement)) {
      setMapViewportHeight(0);
      return;
    }

    const update = (): void => {
      setMapViewportHeight(container.clientHeight);
    };

    return observeElementHeight(container, update, { callImmediately: true });
  }, [enabled, storyRevision, observeElementHeight]);

  const handleMeasuredHeight = useCallback(
    (segmentId: string, height: number) => {
      const measuredHeightPx = Math.ceil(height);

      setHeightsById(prev => {
        if (prev[segmentId] === measuredHeightPx) {
          return prev;
        }

        const scroller = scrollerRef.current;
        const oldLayout =
          enabled && viewportHeight > 0
            ? buildListStoryScrollTrack({
                items,
                viewportHeight,
                mapViewportHeight: mapViewportHeight || undefined,
                heightsById: prev,
              })
            : null;

        const next = { ...prev, [segmentId]: measuredHeightPx };

        if (scroller && oldLayout) {
          const oldSegment = oldLayout.segments.find(s => s.id === segmentId);
          if (oldSegment && !oldSegment.measured) {
            const scrollCompensation = measuredHeightPx - oldSegment.height;
            if (
              scrollCompensation !== 0 &&
              scroller.scrollTop > oldSegment.start
            ) {
              requestAnimationFrame(() => {
                scroller.scrollTop += scrollCompensation;
              });
            }
          }
        }

        return next;
      });
    },
    [enabled, items, mapViewportHeight, viewportHeight],
  );

  const { segmentBeingMeasured, reportHeight, completeMeasure } =
    useQueuedMarkdownHeightMeasure({
      enabled: enabled && viewportHeight > 0,
      markdownSegments,
      currentSegmentIndex,
      heightsById,
      onHeight: handleMeasuredHeight,
    });

  const scrollTrackLayout = useMemo(() => {
    if (!enabled || !items.length || viewportHeight <= 0) {
      return null;
    }

    return buildScrollTrackLayout(heightsById);
  }, [enabled, items, viewportHeight, heightsById, buildScrollTrackLayout]);

  const scrollToSegmentIndex = useCallback(
    (index: number, options?: { behavior?: ScrollBehavior }) => {
      const safeIndex = Math.max(0, index);
      const scroller = scrollerRef.current;
      const segment = scrollTrackLayout?.segments.find(
        s => s.index === safeIndex,
      );

      if (scroller && segment != null) {
        scroller.scrollTo({
          top: segment.start,
          behavior: options?.behavior ?? 'smooth',
        });
        return;
      }

      model.setCurrentSegmentIndex(safeIndex);
    },
    [model, scrollTrackLayout],
  );

  const value = useMemo(
    (): IListStoryScrollTrackContextValue => ({
      scrollTrackLayout,
      scrollTop,
      bindScrollTrackElement,
      scrollToSegmentIndex,
    }),
    [
      scrollTrackLayout,
      scrollTop,
      bindScrollTrackElement,
      scrollToSegmentIndex,
    ],
  );

  return (
    <ListStoryScrollTrackContext.Provider value={value}>
      {children}
      {enabled && segmentBeingMeasured ? (
        <div className="jgis-story-markdown-measure-host" aria-hidden>
          <ListStoryMarkdownMeasurePane
            key={segmentBeingMeasured.id}
            segmentId={segmentBeingMeasured.id}
            markdown={segmentBeingMeasured.markdown}
            onHeight={reportHeight}
            onMeasureComplete={completeMeasure}
          />
        </div>
      ) : null}
    </ListStoryScrollTrackContext.Provider>
  );
}

export function useListStoryScrollTrackContext(): IListStoryScrollTrackContextValue {
  const value = useContext(ListStoryScrollTrackContext);
  if (!value) {
    throw new Error(
      'useListStoryScrollTrackContext must be used within ListStoryScrollTrackProvider',
    );
  }
  return value;
}
