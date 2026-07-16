'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import {
  type MarketDataPanelKey,
  type MarketPanelKey,
} from '@/lib/market';
import Stock from '@/features/dashboard/stocks/Stock';
import PanelContent from './PanelContent';
import PanelFreshness from './PanelFreshness';
import { PanelFreshnessSkeleton } from './PanelLoadingSkeleton';
import { sortStocks } from '@/features/dashboard/stocks/stockSorting';
import {
  StockTable,
  StockTableEmptyState,
  StockTableFavoritesFailedItemsState,
  StockTableErrorState,
  StockTableFavoritesEmptyState,
  StockTableFavoritesMissingItemsState,
  StockTableFreshFavoritesState,
  StockTableLoadingState,
  StockTableStaleFavoritesState,
  StockTableStaleErrorState,
} from '@/features/dashboard/stocks/StockTable';
import { useMarketPanel } from '@/features/dashboard/panel/useMarketPanel';
import { useFavoritePanel } from '@/features/dashboard/favorites/useFavoritePanel';
import { useFavoriteStocks } from '@/features/dashboard/favorites/useFavoriteStocks';
import { useStockSortState } from '@/features/dashboard/stocks/useStockSortState';
import { useDashboardPanelState } from '@/features/dashboard/panel/useDashboardPanelState';
import { useSelectedStockModal } from '@/features/dashboard/stock-detail/useSelectedStockModal';
import { getMarketPanelOption } from '@/features/dashboard/panel/marketPanelOptions';
import { type StockData } from '@/features/dashboard/shared/stockData';
import { resolvePanelRows } from '@/features/dashboard/panel/panelState';
import { type MarketPanelSuccessResponse } from '@/features/dashboard/panel/marketPanelClient';
import { normalizeTicker } from '@/features/dashboard/shared/ticker';
import { useIsMobileViewport } from '@/features/dashboard/shared/useIsMobileViewport';
import { type Theme } from '@/lib/theme';

const StockDetailsModal = dynamic(() => import('@/features/dashboard/stock-detail/StockDetailsModal'), {
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
  const { push } = useRouter();
  const isMobileViewport = useIsMobileViewport();
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
    isRefreshing,
    hasStaleError,
    stale,
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
  const favoriteFailedItems = isFavoritesPanel ? favoritePanelState.failedItems : [];
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
  const handleStockOpen = useCallback(
    (stock: StockData) => {
      if (isMobileViewport) {
        clearSelectedStock();
        push(`/stocks/${encodeURIComponent(stock.ticker)}`);
        return;
      }

      handleStockSelect(stock);
    },
    [clearSelectedStock, handleStockSelect, isMobileViewport, push],
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
      status={
        effectiveViewStatus === 'loading' ? (
          <PanelFreshnessSkeleton />
        ) : (
          <PanelFreshness
            fetchedAt={fetchedAt}
            isRefreshing={isRefreshing}
            stale={stale}
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
            <>
              <StockTableFavoritesMissingItemsState items={favoriteMissingItems} />
              <StockTableFavoritesFailedItemsState items={favoriteFailedItems} />
            </>
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
                  opensInModal={!isMobileViewport}
                  onSelect={handleStockOpen}
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
