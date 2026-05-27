'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type MarketDataPanelKey } from '@/lib/market';
import {
  normalizeFavoriteIdentities,
  normalizeFavoriteSymbol,
  type FavoriteStockIdentity,
} from '@/lib/favorites';
import { DEFAULT_STOCK_HISTORY_MARKET } from '@/lib/stockHistory';
import { type StockData } from '../lib/stockData';
import { normalizeTicker } from '../lib/ticker';

export const FAVORITE_STOCKS_STORAGE_KEY =
  'argentina-market-tracker:favorites';
export const FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY =
  'argentina-market-tracker:favorite-stock-snapshots';

type SafeStorage = Pick<Storage, 'getItem' | 'setItem'>;

function getStorage(): SafeStorage | null {
  try {
    if (typeof window === 'undefined' || !('localStorage' in window)) {
      return null;
    }

    return window.localStorage;
  } catch {
    return null;
  }
}

function safeGetStorageItem(key: string): string | null {
  const storage = getStorage();

  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorageItem(key: string, value: string) {
  const storage = getStorage();

  if (!storage) return;

  try {
    storage.setItem(key, value);
  } catch {
    // Favorites should keep working even when storage is blocked or full.
  }
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

function readStoredFavorites(): FavoriteStockIdentity[] {
  const storedValue = safeGetStorageItem(FAVORITE_STOCKS_STORAGE_KEY);

  if (!storedValue) return [];

  try {
    return normalizeFavoriteIdentities(JSON.parse(storedValue));
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
  const storedValue = safeGetStorageItem(FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY);

  if (!storedValue) return {};

  try {
    return normalizeFavoriteSnapshots(JSON.parse(storedValue));
  } catch {
    return {};
  }
}

export function useFavoriteStocks() {
  const [favoriteItems, setFavoriteItems] = useState<FavoriteStockIdentity[]>([]);
  const [favoriteSnapshotsByTicker, setFavoriteSnapshotsByTicker] = useState<
    Record<string, StockData>
  >({});
  const [didLoad, setDidLoad] = useState(false);
  const favoriteItemsRef = useRef<FavoriteStockIdentity[]>([]);
  const favoriteSnapshotsRef = useRef<Record<string, StockData>>({});

  useEffect(() => {
    // localStorage is only available after client mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavoriteItems(readStoredFavorites());
    setFavoriteSnapshotsByTicker(readStoredFavoriteSnapshots());
    setDidLoad(true);
  }, []);

  useEffect(() => {
    if (!didLoad) return;

    safeSetStorageItem(
      FAVORITE_STOCKS_STORAGE_KEY,
      JSON.stringify(favoriteItems),
    );
    safeSetStorageItem(
      FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY,
      JSON.stringify(favoriteSnapshotsByTicker),
    );
  }, [didLoad, favoriteItems, favoriteSnapshotsByTicker]);

  useEffect(() => {
    favoriteItemsRef.current = favoriteItems;
  }, [favoriteItems]);

  useEffect(() => {
    favoriteSnapshotsRef.current = favoriteSnapshotsByTicker;
  }, [favoriteSnapshotsByTicker]);

  const favorites = useMemo(
    () => favoriteItems.map((item) => item.symbol),
    [favoriteItems]
  );
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const isFavorite = useCallback(
    (ticker: string) => favoriteSet.has(normalizeTicker(ticker)),
    [favoriteSet],
  );

  const toggleFavorite = useCallback((
    ticker: string,
    options: {
      market?: FavoriteStockIdentity['market']
      sourcePanel?: MarketDataPanelKey
    } = {}
  ) => {
    const normalizedTicker = normalizeFavoriteSymbol(ticker);

    if (!normalizedTicker) return;

    setFavoriteItems((currentFavorites) => {
      const nextFavorites = [...currentFavorites];
      const existingIndex = nextFavorites.findIndex(
        (item) => item.symbol === normalizedTicker
      );

      if (existingIndex >= 0) {
        nextFavorites.splice(existingIndex, 1);
      } else {
        nextFavorites.push({
          symbol: normalizedTicker,
          market: options.market ?? DEFAULT_STOCK_HISTORY_MARKET,
          ...(options.sourcePanel ? { sourcePanel: options.sourcePanel } : {}),
        });
      }

      return nextFavorites.sort((left, right) =>
        left.symbol.localeCompare(right.symbol)
      );
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

  const toggleFavoriteStock = useCallback((
    stock: StockData,
    options: {
      market?: FavoriteStockIdentity['market']
      sourcePanel?: MarketDataPanelKey
    } = {}
  ) => {
    const snapshot = normalizeFavoriteSnapshot(stock);

    if (!snapshot) return;

    const currentFavorites = favoriteItemsRef.current;
    const nextFavorites = [...currentFavorites];
    const existingIndex = nextFavorites.findIndex(
      (item) => item.symbol === snapshot.ticker
    );
    const isCurrentlyFavorite = existingIndex >= 0;

    if (isCurrentlyFavorite) {
      nextFavorites.splice(existingIndex, 1);
    } else {
      nextFavorites.push({
        symbol: snapshot.ticker,
        market: options.market ?? DEFAULT_STOCK_HISTORY_MARKET,
        ...(options.sourcePanel ? { sourcePanel: options.sourcePanel } : {}),
      });
    }

    const nextFavoritesList = nextFavorites.sort((left, right) =>
      left.symbol.localeCompare(right.symbol)
    );
    const currentSnapshots = favoriteSnapshotsRef.current;
    let nextSnapshots = currentSnapshots;

    if (isCurrentlyFavorite) {
      if (snapshot.ticker in currentSnapshots) {
        nextSnapshots = { ...currentSnapshots };
        delete nextSnapshots[snapshot.ticker];
      }
    } else {
      nextSnapshots = {
        ...currentSnapshots,
        [snapshot.ticker]: snapshot,
      };
    }

    favoriteItemsRef.current = nextFavoritesList;
    favoriteSnapshotsRef.current = nextSnapshots;
    setFavoriteItems(nextFavoritesList);
    setFavoriteSnapshotsByTicker(nextSnapshots);
  }, []);

  return {
    favorites,
    favoriteItems,
    favoriteSet,
    favoriteSnapshotsByTicker,
    addFavoriteSnapshot,
    isFavorite,
    removeFavoriteSnapshot,
    toggleFavorite,
    toggleFavoriteStock,
  };
}
