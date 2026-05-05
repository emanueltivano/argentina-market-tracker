'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isMarketPanelKey, type MarketPanelKey } from '@/lib/market';
import Stock, { type StockData } from './Stock';
import PanelContent from './PanelContent';
import PanelFreshness from './PanelFreshness';
import StockDetailsModal from './StockDetailsModal';
import { StockTable, StockTableStatus } from './StockTable';
import { useMarketPanel } from '../hooks/useMarketPanel';

type PanelProps = {
  defaultPanel?: MarketPanelKey;
};

export default function Panel({ defaultPanel = 'lider' }: PanelProps) {
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
    isInitialLoading,
    isRefreshing,
    hasStaleError,
    isEmpty,
    isErrorWithoutData,
  } = useMarketPanel(activePanelKey);

  const errorMessage = error?.message ?? 'Error desconocido';

  const handleStockSelect = useCallback(
    (stock: StockData) => {
      setSelectedStock(stock);
    },
    [],
  );

  const handleCloseStockDetails = useCallback(() => {
    setSelectedStock(null);
  }, []);

  function handlePanelChange(key: MarketPanelKey) {
    const nextParams = new URLSearchParams(searchParams.toString());

    setSelectedStock(null);
    nextParams.set('panel', key);

    router.replace(`${pathname}?${nextParams.toString()}`, {
      scroll: false,
    });
  }

  const freshnessControls = (
    <PanelFreshness
      fetchedAt={fetchedAt}
      isRefreshing={isRefreshing}
      onRefresh={refresh}
    />
  );

  let content: ReactNode;

  if (isErrorWithoutData) {
    content = (
      <StockTable isBusy={false}>
        <StockTableStatus>
          <p className="text-red-400" role="alert">
            Error cargando datos: {errorMessage}
          </p>
        </StockTableStatus>
      </StockTable>
    );
  } else if (isInitialLoading) {
    content = (
      <StockTable isBusy>
        <StockTableStatus>
          <div
            className="flex items-center justify-center py-8"
            role="status"
            aria-live="polite"
          >
            <span className="sr-only">Cargando datos...</span>
            <div className="loader" />
          </div>
        </StockTableStatus>
      </StockTable>
    );
  } else if (isEmpty) {
    content = (
      <StockTable isBusy={false}>
        <StockTableStatus>
          <p className="text-gray-500" role="status" aria-live="polite">
            No hay datos disponibles.
          </p>
        </StockTableStatus>
      </StockTable>
    );
  } else {
    content = (
      <>
        {isRefreshing && (
          <p
            className="mb-2 text-sm text-gray-500"
            role="status"
            aria-live="polite"
          >
            Actualizando datos...
          </p>
        )}

        {hasStaleError && (
          <p
            className="mb-2 text-sm text-yellow-400"
            role="status"
            aria-live="polite"
          >
            No se pudo actualizar. Mostrando últimos datos disponibles.
          </p>
        )}

        <StockTable isBusy={isRefreshing}>
          {rows.map((row) => (
            <Stock
              key={row.ticker}
              {...row}
              onSelect={handleStockSelect}
            />
          ))}
        </StockTable>

        {selectedStock && (
          <StockDetailsModal
            stock={selectedStock}
            onClose={handleCloseStockDetails}
          />
        )}
      </>
    );
  }

  return (
    <PanelContent
      title={activePanel.title}
      activePanelKey={activePanelKey}
      onChange={handlePanelChange}
      actions={freshnessControls}
    >
      {content}
    </PanelContent>
  );
}
