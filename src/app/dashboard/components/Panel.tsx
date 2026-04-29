'use client';

import { type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isMarketPanelKey, type MarketPanelKey } from '@/lib/market';
import Stock from './Stock';
import NavStocks from './NavStocks';
import PanelContent from './PanelContent';
import { useMarketPanel } from '../hooks/useMarketPanel';

const STOCK_TABLE_COLUMN_COUNT = 12;

type PanelProps = {
  defaultPanel?: MarketPanelKey;
};

function StockTable({ children }: { children: ReactNode }) {
  return (
    <table className='stock-table'>
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

export default function Panel({ defaultPanel = 'lider' }: PanelProps) {
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
    isLoading,
    hasError,
    isEmpty,
    isInitialError,
  } = useMarketPanel(activePanelKey);

  const errorMessage = error?.message ?? 'Error desconocido';

  function handlePanelChange(key: MarketPanelKey) {
    const nextParams = new URLSearchParams(searchParams.toString());

    nextParams.set('panel', key);

    router.replace(`${pathname}?${nextParams.toString()}`, {
      scroll: false,
    });
  }

  if (isInitialError) {
    return (
      <PanelContent
        title={activePanel.title}
        activePanelKey={activePanelKey}
        onChange={handlePanelChange}
      >
        <StockTable>
          <StockTableStatus>
            <p className='text-red-400'>Error cargando datos: {errorMessage}</p>
          </StockTableStatus>
        </StockTable>
      </PanelContent>
    );
  }

  if (isLoading) {
    return (
      <PanelContent
        title={activePanel.title}
        activePanelKey={activePanelKey}
        onChange={handlePanelChange}
      >
        <StockTable>
          <StockTableStatus>
            <div className='flex items-center justify-center py-8' role='status'>
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
        <StockTable>
          <StockTableStatus>
            {hasError && (
              <p className='mb-2 text-sm text-yellow-400' role='status'>
                No se pudo actualizar. Mostrando últimos datos disponibles.
              </p>
            )}

            <p className='text-gray-500' role='status'>
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
      {hasError && (
        <p className='mb-2 text-sm text-yellow-400' role='status'>
          No se pudo actualizar. Mostrando últimos datos disponibles.
        </p>
      )}

      <StockTable>
        {rows.map((row) => (
          <Stock key={row.ticker} {...row} />
        ))}
      </StockTable>
    </PanelContent>
  );
}
