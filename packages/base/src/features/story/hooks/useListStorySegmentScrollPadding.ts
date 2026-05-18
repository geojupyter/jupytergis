import { RefObject, useLayoutEffect } from 'react';

const PAD_TOP_VAR = '--jgis-list-scroll-pad-top';
const PAD_BOTTOM_VAR = '--jgis-list-scroll-pad-bottom';
const MAX_ATTACH_FRAMES = 120;

function edgePad(scrollerHeight: number, cardHeight: number): number {
  return Math.max(0, (scrollerHeight - cardHeight) / 2);
}

/**
 * Centers the first/last list cards in the story scroller when at scroll
 * extremes by setting padding on `.jgis-story-segment-list`.
 */
export function useListStorySegmentScrollPadding(
  scrollerRef: RefObject<HTMLDivElement | null>,
  listRef: RefObject<HTMLDivElement | null>,
  itemCount: number,
): void {
  useLayoutEffect(() => {
    if (itemCount < 1) {
      return;
    }

    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let attachFrame = 0;

    const clearPadding = (list: HTMLDivElement): void => {
      list.style.removeProperty(PAD_TOP_VAR);
      list.style.removeProperty(PAD_BOTTOM_VAR);
    };

    const teardown = (list: HTMLDivElement | null): void => {
      ro?.disconnect();
      ro = null;
      if (list) {
        clearPadding(list);
      }
    };

    const attach = (): boolean => {
      const scroller = scrollerRef.current;
      const list = listRef.current;
      if (!scroller || !list) {
        return false;
      }

      const observed = new Set<Element>();

      const update = (): void => {
        const cards = list.querySelectorAll<HTMLElement>(
          '.jgis-story-segment-card',
        );
        if (cards.length === 0) {
          return;
        }

        const first = cards[0];
        const last = cards[cards.length - 1];
        const scrollerHeight = scroller.clientHeight;

        list.style.setProperty(
          PAD_TOP_VAR,
          `${edgePad(scrollerHeight, first.offsetHeight)}px`,
        );
        list.style.setProperty(
          PAD_BOTTOM_VAR,
          `${edgePad(scrollerHeight, last.offsetHeight)}px`,
        );
      };

      const observeCardEdges = (): void => {
        const cards = list.querySelectorAll<HTMLElement>(
          '.jgis-story-segment-card',
        );
        if (cards.length === 0 || !ro) {
          return;
        }
        const first = cards[0];
        const last = cards[cards.length - 1];
        for (const el of first === last ? [first] : [first, last]) {
          if (!observed.has(el)) {
            observed.add(el);
            ro.observe(el);
          }
        }
      };

      ro = new ResizeObserver(() => {
        observeCardEdges();
        update();
      });

      ro.observe(scroller);
      ro.observe(list);
      observeCardEdges();
      update();
      return true;
    };

    const tryAttach = (): void => {
      if (cancelled) {
        return;
      }
      if (attach()) {
        return;
      }
      attachFrame += 1;
      if (attachFrame < MAX_ATTACH_FRAMES) {
        requestAnimationFrame(tryAttach);
      }
    };

    tryAttach();

    return () => {
      cancelled = true;
      teardown(listRef.current);
    };
  }, [scrollerRef, listRef, itemCount]);
}
