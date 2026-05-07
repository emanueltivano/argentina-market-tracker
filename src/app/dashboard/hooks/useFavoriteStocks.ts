'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export const FAVORITE_STOCKS_STORAGE_KEY =
  'argentina-market-tracker:favorites';

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function normalizeFavorites(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((ticker): ticker is string => typeof ticker === 'string')
        .map(normalizeTicker)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function readStoredFavorites(): string[] {
  const storedValue = window.localStorage.getItem(FAVORITE_STOCKS_STORAGE_KEY);

  if (!storedValue) return [];

  try {
    return normalizeFavorites(JSON.parse(storedValue));
  } catch {
    return [];
  }
}

export function useFavoriteStocks() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [didLoad, setDidLoad] = useState(false);

  useEffect(() => {
    let isMounted = true;

    window.queueMicrotask(() => {
      if (!isMounted) return;

      setFavorites(readStoredFavorites());
      setDidLoad(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!didLoad) return;

    window.localStorage.setItem(
      FAVORITE_STOCKS_STORAGE_KEY,
      JSON.stringify(favorites),
    );
  }, [didLoad, favorites]);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const isFavorite = useCallback(
    (ticker: string) => favoriteSet.has(normalizeTicker(ticker)),
    [favoriteSet],
  );

  const toggleFavorite = useCallback((ticker: string) => {
    const normalizedTicker = normalizeTicker(ticker);

    if (!normalizedTicker) return;

    setFavorites((currentFavorites) => {
      const nextFavorites = new Set(currentFavorites);

      if (nextFavorites.has(normalizedTicker)) {
        nextFavorites.delete(normalizedTicker);
      } else {
        nextFavorites.add(normalizedTicker);
      }

      return [...nextFavorites].sort((a, b) => a.localeCompare(b));
    });
  }, []);

  return {
    favorites,
    favoriteSet,
    isFavorite,
    toggleFavorite,
  };
}
