'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isMarketPanelKey, type MarketPanelKey } from '@/lib/market';
import Stock, { type StockData } from './Stock';
import NavStocks from './NavStocks';
import PanelContent from './PanelContent';
import StockDetailsModal from './StockDetailsModal';
import { useMarketPanel } from '../hooks/useMarketPanel';

const STOCK_TABLE_COLUMN_COUNT = 12;
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

type PanelProps = {
  defaultPanel?: MarketPanelKey;
};

const updatedAtFormatter = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function StockTable({
  children,
  isBusy,
}: {
  children: ReactNode;
  isBusy: boolean;
}) {
  return (
    <table className='stock-table' aria-busy={isBusy}>
      <caption className='sr-only'>Panel de acciones</caption>
      <NavStocks />
      <tbody className='divide-y divide-gray-200'>{children}</tbody>
    </table>
  );
}

function StockTableStatus({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td className='stock-status-cell' colSpan={STOCK_TABLE_COLUMN_COUNT}>
        {children}
      </td>
    </tr>
  );
}

function formatUpdatedAt(value: string | undefined): string {
  if (!value) {
    return 'Última actualización no disponible';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Última actualización no disponible';
  }

  return `Última actualización: ${updatedAtFormatter.format(date)}`;
}

function PanelFreshness({
  fetchedAt,
  isRefreshing,
  onRefresh,
}: {
  fetchedAt: string | undefined;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
      <p aria-live="polite">{formatUpdatedAt(fetchedAt)}</p>
      <button
        type="button"
        className="panel-refresh-button"
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? 'Actualizando...' : 'Actualizar'}
      </button>
    </div>
  );
}

export default function Panel({ defaultPanel = 'lider' }: PanelProps) {
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [canOpenStockDetails, setCanOpenStockDetails] = useState(false);
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

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);

    function updateCanOpenStockDetails() {
      const isDesktop = mediaQuery.matches;

      setCanOpenStockDetails(isDesktop);

      if (!isDesktop) {
        setSelectedStock(null);
      }
    }

    updateCanOpenStockDetails();
    mediaQuery.addEventListener('change', updateCanOpenStockDetails);

    return () => {
      mediaQuery.removeEventListener('change', updateCanOpenStockDetails);
    };
  }, []);

  const handleStockSelect = useCallback(
    (stock: StockData) => {
      if (canOpenStockDetails) {
        setSelectedStock(stock);
      }
    },
    [canOpenStockDetails],
  );

  const handleCloseStockDetails = useCallback(() => {
    setSelectedStock(null);
  }, []);

  const handleManualRefresh = useCallback(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  function handlePanelChange(key: MarketPanelKey) {
    const nextParams = new URLSearchParams(searchParams.toString());

    setSelectedStock(null);
    nextParams.set('panel', key);

    router.replace(`${pathname}?${nextParams.toString()}`, {
      scroll: false,
    });
  }

  if (isErrorWithoutData) {
    return (
      <PanelContent
        title={activePanel.title}
        activePanelKey={activePanelKey}
        onChange={handlePanelChange}
      >
        <PanelFreshness
          fetchedAt={fetchedAt}
          isRefreshing={isRefreshing}
          onRefresh={handleManualRefresh}
        />
        <StockTable isBusy={false}>
          <StockTableStatus>
            <p className='text-red-400' role='alert'>
              Error cargando datos: {errorMessage}
            </p>
          </StockTableStatus>
        </StockTable>
      </PanelContent>
    );
  }

  if (isInitialLoading) {
    return (
      <PanelContent
        title={activePanel.title}
        activePanelKey={activePanelKey}
        onChange={handlePanelChange}
      >
        <StockTable isBusy>
          <StockTableStatus>
            <div
              className='flex items-center justify-center py-8'
              role='status'
              aria-live='polite'
            >
              <span className='sr-only'>Cargando datos...</span>
              <div className='loader' />
            </div>
          </StockTableStatus>
        </StockTable>
      </PanelContent>
    );
  }

  if (isEmpty) {
    return (
      <PanelContent
        title={activePanel.title}
        activePanelKey={activePanelKey}
        onChange={handlePanelChange}
      >
        <PanelFreshness
          fetchedAt={fetchedAt}
          isRefreshing={isRefreshing}
          onRefresh={handleManualRefresh}
        />
        <StockTable isBusy={false}>
          <StockTableStatus>
            <p className='text-gray-500' role='status' aria-live='polite'>
              No hay datos disponibles.
            </p>
          </StockTableStatus>
        </StockTable>
      </PanelContent>
    );
  }

  return (
    <PanelContent
      title={activePanel.title}
      activePanelKey={activePanelKey}
      onChange={handlePanelChange}
    >
      {isRefreshing && (
        <p className='mb-2 text-sm text-gray-500' role='status' aria-live='polite'>
          Actualizando datos...
        </p>
      )}

      <PanelFreshness
        fetchedAt={fetchedAt}
        isRefreshing={isRefreshing}
        onRefresh={handleManualRefresh}
      />

      {hasStaleError && (
        <p className='mb-2 text-sm text-yellow-400' role='status' aria-live='polite'>
          No se pudo actualizar. Mostrando últimos datos disponibles.
        </p>
      )}

      <StockTable isBusy={isRefreshing}>
        {rows.map((row) => (
          <Stock
            key={row.ticker}
            {...row}
            canOpenDetails={canOpenStockDetails}
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
    </PanelContent>
  );
}
