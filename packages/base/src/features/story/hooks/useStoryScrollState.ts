import { RefObject, useEffect, useRef } from 'react';

/**
 * Specta story column scroll tracking.
 * - `scrollContainerRef`: list + single both attach here (`#jgis-story-segment-panel`).
 * - Sentinels are only mounted in single mode; list mode skips the observer.
 * - `getAtTop` / `getAtBottom`: used by MainView wheel for guided/unguided edges.
 */
interface IUseStoryScrollStateParams {
  currentIndex: number;
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
}: IUseStoryScrollStateParams): IUseStoryScrollStateResult {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const atTopRef = useRef(false);
  const atBottomRef = useRef(false);

  useEffect(() => {
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
  }, [currentIndex]);

  return {
    scrollContainerRef,
    topSentinelRef,
    bottomSentinelRef,
    getAtTop: () => atTopRef.current,
    getAtBottom: () => atBottomRef.current,
  };
}
