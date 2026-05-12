'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  isMarketPanelKey,
  type MarketDataPanelKey,
  type MarketPanelKey,
} from '@/lib/market';
import Stock from './Stock';
import PanelContent from './PanelContent';
import PanelFreshness from './PanelFreshness';
import { PanelFreshnessSkeleton } from './PanelLoadingSkeleton';
import StockDetailsModal from './StockDetailsModal';
import { sortStocks } from '../lib/stockSorting';
import {
  setStockSortSearchParams,
} from '../lib/stockSortPersistence';
import {
  StockTable,
  StockTableEmptyState,
  StockTableErrorState,
  StockTableFavoritesEmptyState,
  StockTableLoadingState,
  StockTableStaleFavoritesState,
  StockTableStaleErrorState,
} from './StockTable';
import { useMarketPanel } from '../hooks/useMarketPanel';
import { normalizeTicker, useFavoriteStocks } from '../hooks/useFavoriteStocks';
import { useStockSortState } from '../hooks/useStockSortState';
import { getMarketPanelOption } from '../lib/marketPanelOptions';
import { type StockData } from '../lib/stockData';

type PanelProps = {
  defaultPanel?: MarketDataPanelKey;
};

export default function Panel({ defaultPanel = 'lider' }: PanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { sort, handleSortChange } = useStockSortState();
  const {
    addFavoriteSnapshot,
    favorites,
    favoriteSnapshotsByTicker,
    isFavorite,
    removeFavoriteSnapshot,
    toggleFavorite,
  } = useFavoriteStocks();

  const panelParam = searchParams.get('panel');

  const activePanelKey = isMarketPanelKey(panelParam)
    ? panelParam
    : defaultPanel;
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [favoritesSourcePanelKey, setFavoritesSourcePanelKey] =
    useState<MarketDataPanelKey>(
      activePanelKey === 'favorites' ? defaultPanel : activePanelKey,
    );
  const isFavoritesPanel = activePanelKey === 'favorites';
  const dataPanelKey = isFavoritesPanel
    ? favoritesSourcePanelKey
    : activePanelKey;
  const activePanel = getMarketPanelOption(activePanelKey);

  const {
    rows,
    error,
    fetchedAt,
    refresh,
    isRefreshing,
    hasStaleError,
    viewStatus,
  } = useMarketPanel(dataPanelKey);

  const errorMessage = error?.message ?? 'Error desconocido';
  const { filteredRows, staleFavoriteTickers } = useMemo(
    () => {
      if (!isFavoritesPanel) {
        return {
          filteredRows: rows,
          staleFavoriteTickers: new Set<string>(),
        };
      }

      const rowsByTicker = new Map<string, StockData>();
      const staleTickers = new Set<string>();

      for (const [ticker, row] of Object.entries(favoriteSnapshotsByTicker)) {
        rowsByTicker.set(ticker, row);
        staleTickers.add(ticker);
      }

      for (const row of rows) {
        const ticker = normalizeTicker(row.ticker);

        rowsByTicker.set(ticker, row);
        staleTickers.delete(ticker);
      }

      return {
        filteredRows: favorites
          .map((ticker) => rowsByTicker.get(ticker))
          .filter((row): row is StockData => row !== undefined),
        staleFavoriteTickers: staleTickers,
      };
    },
    [favoriteSnapshotsByTicker, favorites, isFavoritesPanel, rows],
  );
  const selectedStock = useMemo(
    () =>
      rows.find((row) => row.ticker === selectedTicker) ??
      (isFavoritesPanel && selectedTicker
        ? favoriteSnapshotsByTicker[normalizeTicker(selectedTicker)] ?? null
        : null),
    [favoriteSnapshotsByTicker, isFavoritesPanel, rows, selectedTicker],
  );
  const sortedRows = useMemo(
    () => sortStocks(filteredRows, sort),
    [filteredRows, sort],
  );
  const hasStaleFavoriteRows =
    isFavoritesPanel &&
    sortedRows.some((row) => staleFavoriteTickers.has(normalizeTicker(row.ticker)));
  const effectiveViewStatus =
    isFavoritesPanel && sortedRows.length > 0 ? 'success' : viewStatus;

  const handleStockSelect = useCallback(
    (stock: StockData) => {
      setSelectedTicker(stock.ticker);
    },
    [],
  );

  const handleCloseStockDetails = useCallback(() => {
    setSelectedTicker(null);
  }, []);

  const createToggleFavoriteHandler = useCallback(
    (stock: StockData) => (ticker: string) => {
      const normalizedTicker = normalizeTicker(ticker);

      if (!isFavorite(ticker) && normalizedTicker) {
        addFavoriteSnapshot(stock);
      } else {
        removeFavoriteSnapshot(ticker);
      }

      toggleFavorite(ticker);
    },
    [addFavoriteSnapshot, isFavorite, removeFavoriteSnapshot, toggleFavorite],
  );

  function handlePanelChange(key: MarketPanelKey) {
    const nextParams = new URLSearchParams(searchParams.toString());

    setSelectedTicker(null);
    if (key !== 'favorites') {
      setFavoritesSourcePanelKey(key);
    } else if (activePanelKey !== 'favorites') {
      setFavoritesSourcePanelKey(activePanelKey);
    }
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
        effectiveViewStatus === 'loading' ? (
          <PanelFreshnessSkeleton />
        ) : (
          <PanelFreshness
            fetchedAt={fetchedAt}
            isRefreshing={isRefreshing}
            onRefresh={refresh}
          />
        )
      }
    >
      {effectiveViewStatus === 'loading' && (
        <StockTable
          isBusy
          sort={sort}
          onSortChange={handleSortChange}
        >
          <StockTableLoadingState />
        </StockTable>
      )}

      {effectiveViewStatus === 'error' && (
        <StockTable
          isBusy={false}
          sort={sort}
          onSortChange={handleSortChange}
        >
          <StockTableErrorState message={errorMessage} />
        </StockTable>
      )}

      {effectiveViewStatus === 'empty' && (
        <>
          {hasStaleError && <StockTableStaleErrorState />}

          <StockTable
            isBusy={false}
            hideHeaderOnMobile={isFavoritesPanel}
            sort={sort}
            onSortChange={handleSortChange}
          >
            {isFavoritesPanel ? (
              <StockTableFavoritesEmptyState />
            ) : (
              <StockTableEmptyState />
            )}
          </StockTable>
        </>
      )}

      {effectiveViewStatus === 'success' && (
        <>
          {hasStaleError && <StockTableStaleErrorState />}
          {hasStaleFavoriteRows && <StockTableStaleFavoritesState />}

          <StockTable
            isBusy={isRefreshing}
            hideHeaderOnMobile={isFavoritesPanel && sortedRows.length === 0}
            sort={sort}
            onSortChange={handleSortChange}
          >
            {isFavoritesPanel && sortedRows.length === 0 ? (
              <StockTableFavoritesEmptyState />
            ) : (
              sortedRows.map((row) => (
                <Stock
                  key={row.ticker}
                  {...row}
                  isFavorite={isFavorite(row.ticker)}
                  isStale={staleFavoriteTickers.has(normalizeTicker(row.ticker))}
                  onSelect={handleStockSelect}
                  onToggleFavorite={createToggleFavoriteHandler(row)}
                />
              ))
            )}
          </StockTable>

          {selectedStock && (
            <StockDetailsModal
              stock={selectedStock}
              panelKey={activePanelKey}
              isFavorite={isFavorite(selectedStock.ticker)}
              onToggleFavorite={createToggleFavoriteHandler(selectedStock)}
              onClose={handleCloseStockDetails}
            />
          )}
        </>
      )}
    </PanelContent>
  );
}
