import { useEffect, useState } from 'react';

/**
 * Subscribes to a media query. The initial value is read synchronously so the
 * first render already picks the right layout and nothing flashes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Breakpoints mirror tailwind.config.ts. */
export const MOBILE_QUERY = '(max-width: 767px)';
export const TABLET_QUERY = '(min-width: 768px) and (max-width: 1023px)';
export const DESKTOP_QUERY = '(min-width: 1024px)';
export const HOVER_QUERY = '(hover: hover) and (pointer: fine)';

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}

export function useIsTablet(): boolean {
  return useMediaQuery(TABLET_QUERY);
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}

/** True on devices with a real pointer, where hover affordances make sense. */
export function useHasHover(): boolean {
  return useMediaQuery(HOVER_QUERY);
}

export type Layout = 'mobile' | 'tablet' | 'desktop';

export function useLayout(): Layout {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  return 'desktop';
}
