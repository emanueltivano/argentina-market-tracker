'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isMarketPanelKey, type MarketPanelKey } from '@/lib/market';
import Stock, { type StockData } from './Stock';
import PanelContent from './PanelContent';
import PanelFreshness from './PanelFreshness';
import StockDetailsModal from './StockDetailsModal';
import {
  getNextStockSort,
  sortStocks,
  type StockSort,
  type StockSortKey,
} from './stockSorting';
import {
  parseStoredStockSort,
  parseStockSortSearchParams,
  resolveInitialStockSort,
  serializeStockSort,
  setStockSortSearchParams,
  STOCK_SORT_STORAGE_KEY,
} from './stockSortPersistence';
import {
  StockTable,
  StockTableEmptyState,
  StockTableErrorState,
  StockTableLoadingState,
  StockTableStaleErrorState,
} from './StockTable';
import { useMarketPanel } from '../hooks/useMarketPanel';

type PanelProps = {
  defaultPanel?: MarketPanelKey;
};

const STOCK_SORT_STORAGE_EVENT = 'stock-sort-storage-change';

function readStoredStockSort() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(STOCK_SORT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredStockSort(sort: StockSort) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STOCK_SORT_STORAGE_KEY, serializeStockSort(sort));
    window.dispatchEvent(new Event(STOCK_SORT_STORAGE_EVENT));
  } catch {
    // Sorting must keep working even if storage is unavailable.
  }
}

function subscribeStoredStockSort(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key === STOCK_SORT_STORAGE_KEY) {
      onStoreChange();
    }
  }

  window.addEventListener(STOCK_SORT_STORAGE_EVENT, onStoreChange);
  window.addEventListener('storage', handleStorageChange);

  return () => {
    window.removeEventListener(STOCK_SORT_STORAGE_EVENT, onStoreChange);
    window.removeEventListener('storage', handleStorageChange);
  };
}

function useStoredStockSort() {
  const storedValue = useSyncExternalStore(
    subscribeStoredStockSort,
    readStoredStockSort,
    () => null
  );

  return useMemo(() => parseStoredStockSort(storedValue), [storedValue]);
}

export default function Panel({ defaultPanel = 'lider' }: PanelProps) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [localSort, setLocalSort] = useState<StockSort | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storedSort = useStoredStockSort();
  const urlSort = useMemo(
    () => parseStockSortSearchParams(searchParams),
    [searchParams]
  );
  const hasSortSearchParams =
    searchParams.get('sort') !== null || searchParams.get('dir') !== null;
  const sort = hasSortSearchParams
    ? urlSort ?? resolveInitialStockSort(searchParams, null)
    : localSort ?? storedSort ?? resolveInitialStockSort(searchParams, null);

  const panelParam = searchParams.get('panel');

  const activePanelKey = isMarketPanelKey(panelParam)
    ? panelParam
    : defaultPanel;

  const {
    activePanel,
    rows,
    error,
    fetchedAt,
    refresh,
    isRefreshing,
    hasStaleError,
    viewStatus,
  } = useMarketPanel(activePanelKey);

  const errorMessage = error?.message ?? 'Error desconocido';
  const selectedStock = useMemo(
    () => rows.find((row) => row.ticker === selectedTicker) ?? null,
    [rows, selectedTicker],
  );
  const sortedRows = useMemo(() => sortStocks(rows, sort), [rows, sort]);

  const handleStockSelect = useCallback(
    (stock: StockData) => {
      setSelectedTicker(stock.ticker);
    },
    [],
  );

  const handleCloseStockDetails = useCallback(() => {
    setSelectedTicker(null);
  }, []);

  const handleSortChange = useCallback((key: StockSortKey) => {
    const nextSort = getNextStockSort(sort, key);
    const nextParams = new URLSearchParams(searchParams.toString());

    setStockSortSearchParams(nextParams, nextSort);
    writeStoredStockSort(nextSort);
    setLocalSort(nextSort);

    router.replace(`${pathname}?${nextParams.toString()}`, {
      scroll: false,
    });
  }, [pathname, router, searchParams, sort]);

  function handlePanelChange(key: MarketPanelKey) {
    const nextParams = new URLSearchParams(searchParams.toString());

    setSelectedTicker(null);
    nextParams.set('panel', key);
    setStockSortSearchParams(nextParams, sort);

    router.replace(`${pathname}?${nextParams.toString()}`, {
      scroll: false,
    });
  }

  return (
    <PanelContent
      title={activePanel.title}
      activePanelKey={activePanelKey}
      onChange={handlePanelChange}
      actions={
        <PanelFreshness
          fetchedAt={fetchedAt}
          isRefreshing={isRefreshing}
          onRefresh={refresh}
        />
      }
    >
      {viewStatus === 'loading' && (
        <StockTable
          isBusy
          sort={sort}
          onSortChange={handleSortChange}
        >
          <StockTableLoadingState />
        </StockTable>
      )}

      {viewStatus === 'error' && (
        <StockTable
          isBusy={false}
          sort={sort}
          onSortChange={handleSortChange}
        >
          <StockTableErrorState message={errorMessage} />
        </StockTable>
      )}

      {viewStatus === 'empty' && (
        <>
          {hasStaleError && <StockTableStaleErrorState />}

          <StockTable
            isBusy={false}
            sort={sort}
            onSortChange={handleSortChange}
          >
            <StockTableEmptyState />
          </StockTable>
        </>
      )}

      {viewStatus === 'success' && (
        <>
          {hasStaleError && <StockTableStaleErrorState />}

          <StockTable
            isBusy={isRefreshing}
            sort={sort}
            onSortChange={handleSortChange}
          >
            {sortedRows.map((row) => (
              <Stock key={row.ticker} {...row} onSelect={handleStockSelect} />
            ))}
          </StockTable>

          {selectedStock && (
            <StockDetailsModal
              stock={selectedStock}
              onClose={handleCloseStockDetails}
            />
          )}
        </>
      )}
    </PanelContent>
  );
}
