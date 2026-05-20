import type { IJGISStoryMap, IStorySegmentLayer } from '@jupytergis/schema';
import { RefObject, useCallback, useEffect, useRef } from 'react';

import type { IStorySegmentViewItem } from '@/src/features/story/hooks/useStorySegmentViewItems';
import type {
  IListStoryScrollDrivePayload,
  StorySegmentDisplayMode,
} from '@/src/features/story/types/listStoryScrollDrive';

/**
 * List story: maps vertical scroll position of the story column to a
 * `listScrollDrive` payload (progress between two segment indices).
 *
 * - Listens to scroll on `scrollContainerRef` (Specta list scroller).
 * - Finds `[data-segment-id]` cards, measures their vertical centers in
 *   scroll content space, picks the pair bracketing the viewport center.
 * - Skips map→map pairs (no markdown transition to drive).
 * - Emits null when disabled, missing DOM, or geometry is invalid.
 */

export interface IUseListStoryScrollDriveParams {
  enabled: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  storyData: IJGISStoryMap | null;
  items: IStorySegmentViewItem[];
  onDriveChange: (payload: IListStoryScrollDrivePayload | null) => void;
}

function getSegmentDisplayMode(
  activeSlide: IStorySegmentLayer['parameters'] | undefined,
): StorySegmentDisplayMode {
  if (activeSlide?.content?.contentMode === 'markdown') {
    return 'markdown';
  }
  return 'map';
}

function pairNeedsScrollDrive(
  fromMode: StorySegmentDisplayMode,
  toMode: StorySegmentDisplayMode,
): boolean {
  return !(fromMode === 'map' && toMode === 'map');
}

/** Vertical center of a segment card in the scroller's content coordinates. */
function cardCenterInScrollerContent(
  scroller: HTMLElement,
  card: HTMLElement,
): number {
  const sTop = scroller.getBoundingClientRect().top;
  const cRect = card.getBoundingClientRect();
  const topInContent = scroller.scrollTop + (cRect.top - sTop);
  return topInContent + cRect.height / 2;
}

/** Subscribes to list scroller geometry; calls `onDriveChange` from MainView. */
export function useListStoryScrollDrive({
  enabled,
  scrollContainerRef,
  storyData,
  items,
  onDriveChange,
}: IUseListStoryScrollDriveParams): void {
  const onDriveChangeRef = useRef(onDriveChange);
  onDriveChangeRef.current = onDriveChange;

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const storyDataRef = useRef(storyData);
  storyDataRef.current = storyData;

  const lastDriveRef = useRef<IListStoryScrollDrivePayload | null>(null);

  const rafIdRef = useRef<number | null>(null);

  const emitDrive = useCallback(
    (payload: IListStoryScrollDrivePayload | null, forceClear = false) => {
      if (payload === null) {
        if (!forceClear && lastDriveRef.current !== null) {
          return;
        }
        lastDriveRef.current = null;
      } else {
        lastDriveRef.current = payload;
      }
      onDriveChangeRef.current(payload);
    },
    [],
  );

  const computeAndEmit = useCallback(() => {
    const scroller = scrollContainerRef.current;
    const currentItems = itemsRef.current;
    const currentStoryData = storyDataRef.current;

    if (!enabled || !scroller || currentItems.length < 2 || !currentStoryData) {
      emitDrive(null, true);
      return;
    }

    const byId = new Map<string, HTMLElement>();
    scroller.querySelectorAll<HTMLElement>('[data-segment-id]').forEach(el => {
      const id = el.getAttribute('data-segment-id');
      if (id) {
        byId.set(id, el);
      }
    });

    const centers: Array<number | null> = currentItems.map(item => {
      const el = byId.get(item.id);
      if (!el) {
        return null;
      }
      return cardCenterInScrollerContent(scroller, el);
    });

    if (centers.some(c => c === null)) {
      // Layout not ready (e.g. after active segment class change); keep last overlay.
      if (rafIdRef.current === null) {
        rafIdRef.current = window.requestAnimationFrame(() => {
          rafIdRef.current = null;
          computeAndEmit();
        });
      }
      return;
    }

    const numericCenters = centers as number[];
    const scrollCenter = scroller.scrollTop + scroller.clientHeight / 2;

    let pairIndex: number | null = null;
    for (let i = 0; i < numericCenters.length - 1; i++) {
      const a = numericCenters[i];
      const b = numericCenters[i + 1];
      if (a <= scrollCenter && scrollCenter <= b) {
        pairIndex = i;
        break;
      }
    }

    // Top/bottom padding can place the viewport center outside the first/last
    // pair; clamp so the overlay stays mounted at scroll extremes.
    if (pairIndex === null) {
      if (scrollCenter <= numericCenters[0]) {
        pairIndex = 0;
      } else if (
        scrollCenter >= numericCenters[numericCenters.length - 1]
      ) {
        pairIndex = numericCenters.length - 2;
      } else {
        return;
      }
    }

    const fromItem = currentItems[pairIndex];
    const toItem = currentItems[pairIndex + 1];
    const fromMode = getSegmentDisplayMode(fromItem.activeSlide);
    const toMode = getSegmentDisplayMode(toItem.activeSlide);

    // Map-only boundary: no markdown overlay to interpolate.
    if (!pairNeedsScrollDrive(fromMode, toMode)) {
      emitDrive(null, true);
      return;
    }

    const c0 = numericCenters[pairIndex];
    const c1 = numericCenters[pairIndex + 1];
    const span = c1 - c0;
    if (span <= 0) {
      emitDrive(null, true);
      return;
    }

    const progress = Math.min(1, Math.max(0, (scrollCenter - c0) / span));

    emitDrive({
      progress,
      fromIndex: fromItem.index,
      toIndex: toItem.index,
      fromMode,
      toMode,
    });
  }, [enabled, scrollContainerRef, emitDrive]);

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
    scheduleCompute();
  }, [items, storyData, scheduleCompute]);

  useEffect(() => {
    if (!enabled) {
      emitDrive(null, true);
      return;
    }

    const scroller = scrollContainerRef.current;
    if (!scroller) {
      emitDrive(null, true);
      return;
    }

    const handleScroll = () => {
      scheduleCompute();
    };

    scroller.addEventListener('scroll', handleScroll, { passive: true });

    scheduleCompute();

    return () => {
      scroller.removeEventListener('scroll', handleScroll);
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [enabled, scrollContainerRef, scheduleCompute, emitDrive]);
}
