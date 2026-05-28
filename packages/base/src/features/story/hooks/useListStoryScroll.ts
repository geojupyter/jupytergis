import type { IJGISStoryMap } from '@jupytergis/schema';
import { RefObject, useCallback, useEffect, useRef } from 'react';

import type {
  IListStoryLayout,
  IStorySegmentViewItem,
  IListStoryScrollDrivePayload,
} from '@/src/features/story/types/types';
import {
  computeListStoryScrollState,
  type IListStoryScrollState,
} from '@/src/features/story/utils/computeListStoryScrollState';

function isSameDrive(
  prevDrive: IListStoryScrollDrivePayload | null,
  nextDrive: IListStoryScrollDrivePayload | null,
): boolean {
  if (!prevDrive || !nextDrive) {
    return false;
  }

  return (
    nextDrive.progress === prevDrive.progress &&
    nextDrive.fromIndex === prevDrive.fromIndex &&
    nextDrive.toIndex === prevDrive.toIndex &&
    nextDrive.fromMode === prevDrive.fromMode &&
    nextDrive.toMode === prevDrive.toMode
  );
}

interface IUseListStoryScrollParams {
  enabled: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  storyData: IJGISStoryMap | null;
  layout: IListStoryLayout | null;
  items: IStorySegmentViewItem[];
  currentIndex: number;
  setIndex: (index: number) => void;
  onDriveChange?: (payload: IListStoryScrollDrivePayload | null) => void;
}

export function useListStoryScroll({
  enabled,
  scrollContainerRef,
  storyData,
  layout,
  items,
  currentIndex,
  setIndex,
  onDriveChange,
}: IUseListStoryScrollParams): void {
  const onDriveChangeRef = useRef(onDriveChange);
  onDriveChangeRef.current = onDriveChange;

  const setIndexRef = useRef(setIndex);
  setIndexRef.current = setIndex;

  const storyDataRef = useRef(storyData);
  storyDataRef.current = storyData;

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const latchedRef = useRef<IListStoryScrollState>({
    activeIndex: currentIndex,
    drive: null,
  });
  const rafIdRef = useRef<number | null>(null);

  const clearDrive = useCallback(() => {
    latchedRef.current = {
      activeIndex: currentIndexRef.current,
      drive: null,
    };
    onDriveChangeRef.current?.(null);
  }, []);

  const emitState = useCallback((next: IListStoryScrollState) => {
    const prev = latchedRef.current;
    latchedRef.current = next;

    if (next.activeIndex !== currentIndexRef.current) {
      setIndexRef.current(next.activeIndex);
    }

    const drive = next.drive;
    const prevDrive = prev.drive;

    if (isSameDrive(prevDrive, drive)) {
      return;
    }

    onDriveChangeRef.current?.(drive);
  }, []);

  const computeAndEmit = useCallback(() => {
    const scroller = scrollContainerRef.current;
    const currentLayout = layoutRef.current;
    const currentStoryData = storyDataRef.current;

    if (!enabled || !scroller || !currentStoryData || !currentLayout) {
      clearDrive();
      return;
    }

    const next = computeListStoryScrollState({
      scrollTop: scroller.scrollTop,
      viewportHeight: scroller.clientHeight,
      segments: currentLayout.segments,
    });

    if (!next) {
      return;
    }

    emitState(next);
  }, [enabled, scrollContainerRef, emitState, clearDrive]);

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
      drive: latchedRef.current.drive,
    };
  }, [currentIndex]);

  useEffect(() => {
    scheduleCompute();
  }, [items, storyData, layout, scheduleCompute]);

  useEffect(() => {
    if (!enabled) {
      clearDrive();
      return;
    }

    const scroller = scrollContainerRef.current;
    if (!scroller) {
      clearDrive();
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
  }, [enabled, scrollContainerRef, scheduleCompute, clearDrive]);
}
