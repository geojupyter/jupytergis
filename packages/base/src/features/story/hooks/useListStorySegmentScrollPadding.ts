import { RefObject, useLayoutEffect } from 'react';

import type { IListStoryLayout } from '@/src/features/story/utils/listStoryLayout';

const PAD_TOP_VAR = '--jgis-list-scroll-pad-top';
const PAD_BOTTOM_VAR = '--jgis-list-scroll-pad-bottom';
const MAX_ATTACH_FRAMES = 120;

/**
 * Applies layout edge padding on the virtual track root so the first/last
 * segment ranges can align with the scroller viewport center at extremes.
 */
export function useListStorySegmentScrollPadding(
  scrollerRef: RefObject<HTMLDivElement | null>,
  trackRootRef: RefObject<HTMLDivElement | null>,
  layout: IListStoryLayout | null,
): void {
  useLayoutEffect(() => {
    if (!layout || layout.segments.length < 1) {
      return;
    }

    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let attachFrame = 0;

    const clearPadding = (root: HTMLDivElement): void => {
      root.style.removeProperty(PAD_TOP_VAR);
      root.style.removeProperty(PAD_BOTTOM_VAR);
    };

    const teardown = (root: HTMLDivElement | null): void => {
      ro?.disconnect();
      ro = null;
      if (root) {
        clearPadding(root);
      }
    };

    const attach = (): boolean => {
      const scroller = scrollerRef.current;
      const root = trackRootRef.current;
      if (!scroller || !root) {
        return false;
      }

      const update = (): void => {
        root.style.setProperty(PAD_TOP_VAR, `${layout.padTop}px`);
        root.style.setProperty(PAD_BOTTOM_VAR, `${layout.padBottom}px`);
      };

      ro = new ResizeObserver(update);
      ro.observe(scroller);
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
      teardown(trackRootRef.current);
    };
  }, [scrollerRef, trackRootRef, layout]);
}
