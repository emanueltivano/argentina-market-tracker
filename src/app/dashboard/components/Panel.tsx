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
  StockTableFavoritesMissingItemsState,
  StockTableFreshFavoritesState,
  StockTableLoadingState,
  StockTableStaleFavoritesState,
  StockTableStaleErrorState,
} from './StockTable';
import { useMarketPanel } from '../hooks/useMarketPanel';
import { useFavoritePanel } from '../hooks/useFavoritePanel';
import { useFavoriteStocks } from '../hooks/useFavoriteStocks';
import { useStockSortState } from '../hooks/useStockSortState';
import { useDashboardPanelState } from '../hooks/useDashboardPanelState';
import { useSelectedStockModal } from '../hooks/useSelectedStockModal';
import { getMarketPanelOption } from '../lib/marketPanelOptions';
import { type StockData } from '../lib/stockData';
import { resolvePanelRows } from '../lib/panelState';
import { type MarketPanelSuccessResponse } from '../hooks/marketPanelClient';
import { normalizeTicker } from '../lib/ticker';
import { type Theme } from '@/lib/theme';

const StockDetailsModal = dynamic(() => import('./StockDetailsModal'), {
  ssr: false,
  loading: () => null,
});

type PanelProps = {
  defaultPanel?: MarketDataPanelKey;
  initialData?: MarketPanelSuccessResponse;
  initialErrorMessage?: string;
  initialPanelKey?: MarketDataPanelKey;
  initialTheme?: Theme;
  isDemoMode?: boolean;
};

export default function Panel({
  defaultPanel = 'lider',
  initialData,
  initialErrorMessage,
  initialPanelKey,
  initialTheme,
  isDemoMode = false,
}: PanelProps) {
  const { sort, handleSortChange } = useStockSortState();
  const {
    favorites,
    favoriteItems,
    favoriteSnapshotsByTicker,
    isFavorite,
    toggleFavoriteStock,
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

  const marketPanelState = useMarketPanel(dataPanelKey, {
    enabled: !isFavoritesPanel,
    initialData,
    initialErrorMessage,
    initialPanelKey,
  });
  const favoritePanelState = useFavoritePanel(favoriteItems);
  const {
    rows,
    error,
    fetchedAt,
    refresh,
    isRefreshing,
    hasStaleError,
    viewStatus,
  } = isFavoritesPanel ? favoritePanelState : marketPanelState;

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
  const favoriteMissingItems = isFavoritesPanel ? favoritePanelState.missingItems : [];
  const shouldShowFreshFavoritesState =
    isFavoritesPanel &&
    effectiveViewStatus === 'success' &&
    !hasStaleFavoriteRows;

  const handleToggleFavorite = useCallback(
    (stock: StockData) => {
      toggleFavoriteStock(stock, { sourcePanel: dataPanelKey });
    },
    [dataPanelKey, toggleFavoriteStock],
  );
  const handlePanelContentChange = useCallback((key: MarketPanelKey) => {
    clearSelectedStock();
    handlePanelChange(key);
  }, [clearSelectedStock, handlePanelChange]);

  return (
    <PanelContent
      title={activePanel.title}
      activePanelKey={activePanelKey}
      initialTheme={initialTheme}
      isDemoMode={isDemoMode}
      onChange={handlePanelContentChange}
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
          {shouldShowFreshFavoritesState && <StockTableFreshFavoritesState />}
          {hasStaleFavoriteRows && <StockTableStaleFavoritesState />}
          {isFavoritesPanel && (
            <StockTableFavoritesMissingItemsState items={favoriteMissingItems} />
          )}

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
                  onToggleFavorite={handleToggleFavorite}
                />
              ))
            )}
          </StockTable>

        </>
      )}

      {selectedStock && (
        <StockDetailsModal
          stock={selectedStock}
          panelKey={activePanelKey}
          isFavorite={isFavorite(selectedStock.ticker)}
          onToggleFavorite={handleToggleFavorite}
          onClose={handleCloseStockDetails}
        />
      )}
    </PanelContent>
  );
}
