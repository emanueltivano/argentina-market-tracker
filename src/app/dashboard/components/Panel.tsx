'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo } from 'react';
import {
  type MarketDataPanelKey,
  type MarketPanelKey,
} from '@/lib/market';
import Stock from './Stock';
import PanelContent from './PanelContent';
import PanelFreshness from './PanelFreshness';
import { PanelFreshnessSkeleton } from './PanelLoadingSkeleton';
import { sortStocks } from '../lib/stockSorting';
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
import { useFavoriteStocks } from '../hooks/useFavoriteStocks';
import { useStockSortState } from '../hooks/useStockSortState';
import { useDashboardPanelState } from '../hooks/useDashboardPanelState';
import { useSelectedStockModal } from '../hooks/useSelectedStockModal';
import { getMarketPanelOption } from '../lib/marketPanelOptions';
import { type StockData } from '../lib/stockData';
import { resolvePanelRows } from '../lib/panelState';
import { type MarketPanelSuccessResponse } from '../hooks/marketPanelClient';
import { normalizeTicker } from '../lib/ticker';

const StockDetailsModal = dynamic(() => import('./StockDetailsModal'), {
  ssr: false,
  loading: () => null,
});

type PanelProps = {
  defaultPanel?: MarketDataPanelKey;
  initialData?: MarketPanelSuccessResponse;
  initialErrorMessage?: string;
  initialPanelKey?: MarketDataPanelKey;
};

export default function Panel({
  defaultPanel = 'lider',
  initialData,
  initialErrorMessage,
  initialPanelKey,
}: PanelProps) {
  const { sort, handleSortChange } = useStockSortState();
  const {
    addFavoriteSnapshot,
    favorites,
    favoriteSnapshotsByTicker,
    isFavorite,
    removeFavoriteSnapshot,
    toggleFavorite,
  } = useFavoriteStocks();
  const {
    activePanelKey,
    dataPanelKey,
    isFavoritesPanel,
    handlePanelChange,
  } = useDashboardPanelState({
    defaultPanel,
    sort,
  });
  const activePanel = getMarketPanelOption(activePanelKey);

  const {
    rows,
    error,
    fetchedAt,
    refresh,
    isRefreshing,
    hasStaleError,
    viewStatus,
  } = useMarketPanel(dataPanelKey, {
    initialData,
    initialErrorMessage,
    initialPanelKey,
  });

  const errorMessage = error?.message ?? 'Error desconocido';
  const { filteredRows, staleFavoriteTickers, effectiveViewStatus } = useMemo(
    () =>
      resolvePanelRows({
        rows,
        favorites,
        favoriteSnapshotsByTicker,
        isFavoritesPanel,
        viewStatus,
      }),
    [favoriteSnapshotsByTicker, favorites, isFavoritesPanel, rows, viewStatus],
  );
  const {
    selectedStock,
    handleStockSelect,
    handleCloseStockDetails,
    clearSelectedStock,
  } = useSelectedStockModal({
    rows,
    isFavoritesPanel,
    favoriteSnapshotsByTicker,
  });
  const sortedRows = useMemo(
    () => sortStocks(filteredRows, sort),
    [filteredRows, sort],
  );
  const hasStaleFavoriteRows =
    isFavoritesPanel &&
    sortedRows.some((row) => staleFavoriteTickers.has(normalizeTicker(row.ticker)));

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

  return (
    <PanelContent
      title={activePanel.title}
      activePanelKey={activePanelKey}
      onChange={(key: MarketPanelKey) => {
        clearSelectedStock();
        handlePanelChange(key);
      }}
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
