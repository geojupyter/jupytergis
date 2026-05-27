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
import { useLazyListStoryMarkdownMeasure } from '@/src/features/story/hooks/useLazyListStoryMarkdownMeasure';
import type { IListStoryLayout } from '@/src/features/story/types/types';
import { buildListStoryLayout } from '@/src/features/story/utils/listStoryLayout';
import {
  buildStorySegmentViewItems,
  getListStoryMarkdownSegmentsFromItems,
} from '@/src/features/story/utils/storySegmentViewItems';

interface IListStoryLayoutContextValue {
  layout: IListStoryLayout | null;
  bindScrollContainer: (element: HTMLDivElement | null) => void;
}

const ListStoryLayoutContext = createContext<IListStoryLayoutContextValue>({
  layout: null,
  bindScrollContainer: () => {},
});

interface IListStoryLayoutProviderProps {
  model: IJupyterGISModel;
  enabled: boolean;
  children: React.ReactNode;
}

export function ListStoryLayoutProvider({
  model,
  enabled,
  children,
}: IListStoryLayoutProviderProps): JSX.Element {
  const [storyRevision, setStoryRevision] = useState(0);
  const [heightsById, setHeightsById] = useState<Record<string, number>>({});
  const [viewportHeight, setViewportHeight] = useState(0);
  const [mapViewportHeight, setMapViewportHeight] = useState(0);

  const currentSegmentIndex = useCurrentSegmentIndex(model);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

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

  const buildLayout = useCallback(
    (nextHeightsById: Readonly<Record<string, number>>): IListStoryLayout | null =>
      buildListStoryLayout({
        items,
        viewportHeight,
        mapViewportHeight: mapViewportHeightOption,
        heightsById: nextHeightsById,
      }),
    [items, viewportHeight, mapViewportHeightOption],
  );

  const bindScrollContainer = useCallback((element: HTMLDivElement | null) => {
    scrollerRef.current = element;
    if (!element) {
      setViewportHeight(0);
      return;
    }

    setViewportHeight(element.clientHeight);
  }, []);

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
    const scroller = scrollerRef.current;
    if (!scroller || !enabled) {
      return;
    }

    const update = (): void => {
      setViewportHeight(scroller.clientHeight);
    };

    return observeElementHeight(scroller, update);
  }, [enabled, storyRevision, observeElementHeight]);

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
            ? buildListStoryLayout({
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

  const { measuringSegment, reportHeight, completeMeasure } =
    useLazyListStoryMarkdownMeasure({
      enabled: enabled && viewportHeight > 0,
      markdownSegments,
      currentSegmentIndex,
      heightsById,
      onHeight: handleMeasuredHeight,
    });

  const layout = useMemo(() => {
    if (!enabled || !items.length || viewportHeight <= 0) {
      return null;
    }

    return buildLayout(heightsById);
  }, [enabled, items, viewportHeight, heightsById, buildLayout]);

  const value = useMemo(
    (): IListStoryLayoutContextValue => ({
      layout,
      bindScrollContainer,
    }),
    [layout, bindScrollContainer],
  );

  return (
    <ListStoryLayoutContext.Provider value={value}>
      {children}
      {enabled && measuringSegment ? (
        <div className="jgis-story-markdown-measure-host" aria-hidden>
          <ListStoryMarkdownMeasurePane
            key={measuringSegment.id}
            segmentId={measuringSegment.id}
            markdown={measuringSegment.markdown}
            onHeight={reportHeight}
            onMeasureComplete={completeMeasure}
          />
        </div>
      ) : null}
    </ListStoryLayoutContext.Provider>
  );
}

export function useListStoryLayoutContext(): IListStoryLayoutContextValue {
  return useContext(ListStoryLayoutContext);
}
