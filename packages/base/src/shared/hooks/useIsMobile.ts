import { useEffect, useState, type RefObject } from 'react';

/** Matches story editor / main view narrow layout breakpoint. */
export const JGIS_NARROW_BREAKPOINT = 960;

const MAINVIEW_CONTAINER_SELECTOR = '.jGIS-Mainview-Container';

function resolveObservedElement(
  elementRef?: RefObject<HTMLElement | null> | null,
): HTMLElement | null {
  if (elementRef?.current) {
    return elementRef.current;
  }

  return document.querySelector(MAINVIEW_CONTAINER_SELECTOR);
}

/**
 * True when the main view container (or an explicit element) is below the
 * narrow breakpoint. Uses ResizeObserver.
 */
export function useIsMobile(
  elementRef?: RefObject<HTMLElement | null> | null,
  breakpoint: number = JGIS_NARROW_BREAKPOINT,
): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const element = resolveObservedElement(elementRef);
    if (!element) {
      return;
    }

    const update = (width: number): void => {
      setIsMobile(width < breakpoint);
    };

    update(element.clientWidth);

    const observer = new ResizeObserver(([entry]) => {
      update(entry.contentRect.width);
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [elementRef, breakpoint]);

  return isMobile;
}
