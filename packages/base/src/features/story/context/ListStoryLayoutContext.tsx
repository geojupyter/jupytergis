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
import {
  buildListStoryLayout,
  type IListStoryLayout,
} from '@/src/features/story/utils/listStoryLayout';
import {
  buildStorySegmentViewItems,
  getListStoryMarkdownSegmentsFromItems,
} from '@/src/features/story/utils/storySegmentViewItems';

export interface IListStoryLayoutContextValue {
  layout: IListStoryLayout | null;
  bindScrollContainer: (element: HTMLDivElement | null) => void;
}

const ListStoryLayoutContext = createContext<IListStoryLayoutContextValue>({
  layout: null,
  bindScrollContainer: () => {},
});

export interface IListStoryLayoutProviderProps {
  model: IJupyterGISModel;
  /** When false, layout is null and no markdown measurement runs. */
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
  const heightsRef = useRef(heightsById);
  heightsRef.current = heightsById;

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

  const bindScrollContainer = useCallback((element: HTMLDivElement | null) => {
    scrollerRef.current = element;
    if (!element) {
      setViewportHeight(0);
      return;
    }
    setViewportHeight(element.clientHeight);
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !enabled) {
      return;
    }

    const update = (): void => {
      setViewportHeight(scroller.clientHeight);
    };

    const ro = new ResizeObserver(update);
    ro.observe(scroller);
    return () => {
      ro.disconnect();
    };
  }, [enabled, storyRevision]);

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

    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => {
      ro.disconnect();
    };
  }, [enabled, storyRevision]);

  const handleMeasuredHeight = useCallback(
    (segmentId: string, height: number) => {
      const rounded = Math.ceil(height);
      setHeightsById(prev => {
        if (prev[segmentId] === rounded) {
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

        const next = { ...prev, [segmentId]: rounded };

        if (scroller && oldLayout) {
          const oldSegment = oldLayout.segments.find(s => s.id === segmentId);
          if (oldSegment && !oldSegment.measured) {
            const delta = rounded - oldSegment.height;
            if (delta !== 0 && scroller.scrollTop > oldSegment.start) {
              requestAnimationFrame(() => {
                scroller.scrollTop += delta;
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
    return buildListStoryLayout({
      items,
      viewportHeight,
      mapViewportHeight: mapViewportHeight || undefined,
      heightsById,
    });
  }, [enabled, items, mapViewportHeight, viewportHeight, heightsById]);

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
