'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isMarketPanelKey, type MarketPanelKey } from '@/lib/market';
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
  StockTableLoadingState,
  StockTableStaleErrorState,
} from './StockTable';
import { useMarketPanel } from '../hooks/useMarketPanel';
import { useStockSortState } from '../hooks/useStockSortState';

type PanelProps = {
  defaultPanel?: MarketPanelKey;
};

export default function Panel({ defaultPanel = 'lider' }: PanelProps) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { sort, handleSortChange } = useStockSortState();

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
