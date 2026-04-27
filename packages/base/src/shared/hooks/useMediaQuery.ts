import { useEffect, useState } from 'react';

/**
 * Subscribes to a media query and returns whether it currently matches.
 * Updates when the viewport changes (resize, orientation).
 *
 * @param query - Media query string (e.g. '(max-width: 768px)').
 * @returns True if the query matches, false otherwise (and when window is unavailable).
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}

export default useMediaQuery;
