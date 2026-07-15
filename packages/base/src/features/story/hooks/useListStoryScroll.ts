import type { IJGISStoryMap } from '@jupytergis/schema';
import { RefObject, useCallback, useEffect, useRef } from 'react';

import type {
  IListStoryScrollTrackLayout,
  IStorySegmentViewItem,
  IListStorySegmentTransition,
} from '@/src/features/story/types/types';
import {
  computeListStoryScrollState,
  type IListStoryScrollState,
} from '@/src/features/story/utils/computeListStoryScrollState';

function isSameSegmentTransition(
  prev: IListStorySegmentTransition | null,
  next: IListStorySegmentTransition | null,
): boolean {
  if (!prev || !next) {
    return false;
  }

  return (
    next.progress === prev.progress &&
    next.fromIndex === prev.fromIndex &&
    next.toIndex === prev.toIndex &&
    next.fromMode === prev.fromMode &&
    next.toMode === prev.toMode
  );
}

interface IUseListStoryScrollParams {
  enabled: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  /** Re-run scroll listener when the scroller DOM node mounts. */
  scrollerReady: boolean;
  storyData: IJGISStoryMap | null;
  scrollTrackLayout: IListStoryScrollTrackLayout | null;
  items: IStorySegmentViewItem[];
  currentIndex: number;
  setIndex: (index: number) => void;
  onSegmentTransitionChange?: (
    payload: IListStorySegmentTransition | null,
  ) => void;
}

export function useListStoryScroll({
  enabled,
  scrollContainerRef,
  scrollerReady,
  storyData,
  scrollTrackLayout,
  items,
  currentIndex,
  setIndex,
  onSegmentTransitionChange,
}: IUseListStoryScrollParams): void {
  const onSegmentTransitionChangeRef = useRef(onSegmentTransitionChange);
  onSegmentTransitionChangeRef.current = onSegmentTransitionChange;

  const setIndexRef = useRef(setIndex);
  setIndexRef.current = setIndex;

  const storyDataRef = useRef(storyData);
  storyDataRef.current = storyData;

  const scrollTrackLayoutRef = useRef(scrollTrackLayout);
  scrollTrackLayoutRef.current = scrollTrackLayout;

  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const latchedRef = useRef<IListStoryScrollState>({
    activeIndex: currentIndex,
    segmentTransition: null,
  });
  const rafIdRef = useRef<number | null>(null);

  const clearSegmentTransition = useCallback(() => {
    latchedRef.current = {
      activeIndex: currentIndexRef.current,
      segmentTransition: null,
    };
    onSegmentTransitionChangeRef.current?.(null);
  }, []);

  const emitState = useCallback((next: IListStoryScrollState) => {
    const prev = latchedRef.current;
    latchedRef.current = next;

    if (next.activeIndex !== currentIndexRef.current) {
      setIndexRef.current(next.activeIndex);
    }

    const segmentTransition = next.segmentTransition;
    const prevTransition = prev.segmentTransition;

    if (isSameSegmentTransition(prevTransition, segmentTransition)) {
      return;
    }

    onSegmentTransitionChangeRef.current?.(segmentTransition);
  }, []);

  const computeAndEmit = useCallback(() => {
    const scroller = scrollContainerRef.current;
    const layout = scrollTrackLayoutRef.current;
    const currentStoryData = storyDataRef.current;

    if (!enabled || !scroller || !currentStoryData || !layout) {
      clearSegmentTransition();
      return;
    }

    const next = computeListStoryScrollState({
      scrollTop: scroller.scrollTop,
      viewportHeight: scroller.clientHeight,
      segments: layout.segments,
    });

    if (!next) {
      return;
    }

    emitState(next);
  }, [enabled, scrollContainerRef, emitState, clearSegmentTransition]);

  const scheduleCompute = useCallback(() => {
    if (rafIdRef.current !== null) {
      return;
    }
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      computeAndEmit();
    });
  }, [computeAndEmit]);

  useEffect(() => {
    latchedRef.current = {
      activeIndex: currentIndex,
      segmentTransition: latchedRef.current.segmentTransition,
    };
  }, [currentIndex]);

  useEffect(() => {
    scheduleCompute();
  }, [items, storyData, scrollTrackLayout, scheduleCompute]);

  useEffect(() => {
    if (!enabled) {
      clearSegmentTransition();
      return;
    }

    const scroller = scrollContainerRef.current;
    if (!scroller) {
      clearSegmentTransition();
      return;
    }

    scroller.addEventListener('scroll', scheduleCompute, { passive: true });
    scheduleCompute();

    return () => {
      scroller.removeEventListener('scroll', scheduleCompute);

      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [enabled, scrollContainerRef, scheduleCompute, clearSegmentTransition, scrollerReady]);
}
