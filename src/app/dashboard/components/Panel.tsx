'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  isMarketPanelKey,
  type MarketDataPanelKey,
  type MarketPanelKey,
} from '@/lib/market';
import Stock, { type StockData } from './Stock';
import PanelContent from './PanelContent';
import PanelFreshness from './PanelFreshness';
import StockDetailsModal from './StockDetailsModal';
import { sortStocks } from './stockSorting';
import {
  setStockSortSearchParams,
} from './stockSortPersistence';
import {
  StockTable,
  StockTableEmptyState,
  StockTableErrorState,
  StockTableFavoritesEmptyState,
  StockTableLoadingState,
  StockTableStaleErrorState,
} from './StockTable';
import { useMarketPanel } from '../hooks/useMarketPanel';
import { useFavoriteStocks } from '../hooks/useFavoriteStocks';
import { useStockSortState } from '../hooks/useStockSortState';
import { getMarketPanelOption } from '../lib/marketPanelOptions';

type PanelProps = {
  defaultPanel?: MarketDataPanelKey;
};

export default function Panel({ defaultPanel = 'lider' }: PanelProps) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { sort, handleSortChange } = useStockSortState();
  const { isFavorite, toggleFavorite } = useFavoriteStocks();

  const panelParam = searchParams.get('panel');

  const activePanelKey = isMarketPanelKey(panelParam)
    ? panelParam
    : defaultPanel;
  const isFavoritesPanel = activePanelKey === 'favorites';
  const dataPanelKey = isFavoritesPanel ? defaultPanel : activePanelKey;
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
  const filteredRows = useMemo(
    () =>
      isFavoritesPanel
        ? rows.filter((row) => isFavorite(row.ticker))
        : rows,
    [isFavorite, isFavoritesPanel, rows],
  );
  const selectedStock = useMemo(
    () => filteredRows.find((row) => row.ticker === selectedTicker) ?? null,
    [filteredRows, selectedTicker],
  );
  const sortedRows = useMemo(
    () => sortStocks(filteredRows, sort),
    [filteredRows, sort],
  );

  const handleStockSelect = useCallback(
    (stock: StockData) => {
      setSelectedTicker(stock.ticker);
    },
    [],
  );

  const handleCloseStockDetails = useCallback(() => {
    setSelectedTicker(null);
  }, []);

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
            {isFavoritesPanel ? (
              <StockTableFavoritesEmptyState />
            ) : (
              <StockTableEmptyState />
            )}
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
            {isFavoritesPanel && sortedRows.length === 0 ? (
              <StockTableFavoritesEmptyState />
            ) : (
              sortedRows.map((row) => (
                <Stock
                  key={row.ticker}
                  {...row}
                  isFavorite={isFavorite(row.ticker)}
                  onSelect={handleStockSelect}
                  onToggleFavorite={toggleFavorite}
                />
              ))
            )}
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
