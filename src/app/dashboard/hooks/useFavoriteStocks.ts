'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { type StockData } from '../components/Stock';

export const FAVORITE_STOCKS_STORAGE_KEY =
  'argentina-market-tracker:favorites';
export const FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY =
  'argentina-market-tracker:favorite-stock-snapshots';

export function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isVariationType(value: unknown): value is StockData['varType'] {
  return value === 'positive' || value === 'negative' || value === 'neutral';
}

function normalizeFavoriteSnapshot(value: unknown): StockData | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const ticker =
    typeof record.ticker === 'string' ? normalizeTicker(record.ticker) : '';
  const description =
    typeof record.description === 'string' ? record.description : '';

  if (!ticker) return null;

  return {
    ticker,
    description,
    price: numberOrNull(record.price),
    var: numberOrNull(record.var),
    varType: isVariationType(record.varType) ? record.varType : 'neutral',
    buyQty: numberOrNull(record.buyQty),
    buyPrice: numberOrNull(record.buyPrice),
    sellPrice: numberOrNull(record.sellPrice),
    sellQty: numberOrNull(record.sellQty),
    open: numberOrNull(record.open),
    min: numberOrNull(record.min),
    max: numberOrNull(record.max),
    close: numberOrNull(record.close),
    volume: numberOrNull(record.volume),
  };
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

function normalizeFavoriteSnapshots(value: unknown): Record<string, StockData> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const snapshots: Record<string, StockData> = {};

  for (const item of Object.values(value)) {
    const snapshot = normalizeFavoriteSnapshot(item);

    if (snapshot) {
      snapshots[snapshot.ticker] = snapshot;
    }
  }

  return snapshots;
}

function readStoredFavoriteSnapshots(): Record<string, StockData> {
  const storedValue = window.localStorage.getItem(
    FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY,
  );

  if (!storedValue) return {};

  try {
    return normalizeFavoriteSnapshots(JSON.parse(storedValue));
  } catch {
    return {};
  }
}

export function useFavoriteStocks() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteSnapshotsByTicker, setFavoriteSnapshotsByTicker] = useState<
    Record<string, StockData>
  >({});
  const [didLoad, setDidLoad] = useState(false);

  useEffect(() => {
    // localStorage is only available after client mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavorites(readStoredFavorites());
    setFavoriteSnapshotsByTicker(readStoredFavoriteSnapshots());
    setDidLoad(true);
  }, []);

  useEffect(() => {
    if (!didLoad) return;

    window.localStorage.setItem(
      FAVORITE_STOCKS_STORAGE_KEY,
      JSON.stringify(favorites),
    );
    window.localStorage.setItem(
      FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY,
      JSON.stringify(favoriteSnapshotsByTicker),
    );
  }, [didLoad, favoriteSnapshotsByTicker, favorites]);

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

  const addFavoriteSnapshot = useCallback((stock: StockData) => {
    const snapshot = normalizeFavoriteSnapshot(stock);

    if (!snapshot) return;

    setFavoriteSnapshotsByTicker((currentSnapshots) => ({
      ...currentSnapshots,
      [snapshot.ticker]: snapshot,
    }));
  }, []);

  const removeFavoriteSnapshot = useCallback((ticker: string) => {
    const normalizedTicker = normalizeTicker(ticker);

    if (!normalizedTicker) return;

    setFavoriteSnapshotsByTicker((currentSnapshots) => {
      if (!(normalizedTicker in currentSnapshots)) return currentSnapshots;

      const nextSnapshots = { ...currentSnapshots };

      delete nextSnapshots[normalizedTicker];

      return nextSnapshots;
    });
  }, []);

  return {
    favorites,
    favoriteSet,
    favoriteSnapshotsByTicker,
    addFavoriteSnapshot,
    isFavorite,
    removeFavoriteSnapshot,
    toggleFavorite,
  };
}
