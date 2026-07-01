'use client';

import { useEffect, useState } from 'react';

export const MOBILE_VIEWPORT_MAX_WIDTH = 767;

export function useIsMobileViewport(
  maxWidth = MOBILE_VIEWPORT_MAX_WIDTH,
): boolean {
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const query = `(max-width: ${maxWidth}px)`;

    if (typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia(query);
      const handleChange = () => {
        setIsMobileViewport(mediaQuery.matches);
      };

      handleChange();
      mediaQuery.addEventListener('change', handleChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    const handleResize = () => {
      setIsMobileViewport(window.innerWidth <= maxWidth);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [maxWidth]);

  return isMobileViewport;
}
