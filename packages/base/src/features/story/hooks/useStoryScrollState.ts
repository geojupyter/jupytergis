import { RefObject, useEffect, useRef } from 'react';

/**
 * Specta story column scroll container + optional sentinel tracking.
 * - `scrollContainerRef`: list + single attach here (`#jgis-story-segment-panel`).
 * - With `sentinelsEnabled: false` (list mode), only the ref is used.
 * - `getAtTop` / `getAtBottom`: guided wheel edges (column mode).
 */
interface IUseStoryScrollStateParams {
  currentIndex: number;
  /** When false, only exposes scrollContainerRef (list story virtual track). */
  sentinelsEnabled?: boolean;
}

interface IUseStoryScrollStateResult {
  scrollContainerRef: RefObject<HTMLDivElement>;
  topSentinelRef: RefObject<HTMLDivElement>;
  bottomSentinelRef: RefObject<HTMLDivElement>;
  getAtTop: () => boolean;
  getAtBottom: () => boolean;
}

export function useStoryScrollState({
  currentIndex,
  sentinelsEnabled = true,
}: IUseStoryScrollStateParams): IUseStoryScrollStateResult {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const atTopRef = useRef(false);
  const atBottomRef = useRef(false);

  useEffect(() => {
    if (!sentinelsEnabled) {
      return;
    }

    const root = scrollContainerRef.current;
    const topEl = topSentinelRef.current;
    const bottomEl = bottomSentinelRef.current;
    if (!root || !topEl || !bottomEl) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        for (const entry of entries) {
          if (entry.target === topEl) {
            atTopRef.current = entry.isIntersecting;
          } else if (entry.target === bottomEl) {
            atBottomRef.current = entry.isIntersecting;
          }
        }
      },
      { root, threshold: 0, rootMargin: '0px' },
    );

    observer.observe(topEl);
    observer.observe(bottomEl);

    return () => observer.disconnect();
  }, [currentIndex, sentinelsEnabled]);

  return {
    scrollContainerRef,
    topSentinelRef,
    bottomSentinelRef,
    getAtTop: () => atTopRef.current,
    getAtBottom: () => atBottomRef.current,
  };
}
