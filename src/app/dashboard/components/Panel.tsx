'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isMarketPanelKey, type MarketPanelKey } from '@/lib/market';
import Stock from './Stock';
import PanelContent from './PanelContent';
import { useMarketPanel } from '../hooks/useMarketPanel';

type PanelProps = {
  defaultPanel?: MarketPanelKey;
};

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
        <p className="text-red-400">Error cargando datos: {error.message}</p>
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
        <p className="text-gray-500" role="status">
          Cargando datos...
        </p>
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
        {hasError && (
          <p className="mb-2 text-sm text-yellow-400" role="status">
            No se pudo actualizar. Mostrando últimos datos disponibles.
          </p>
        )}

        <p className="text-gray-500" role="status">
          No hay datos disponibles.
        </p>
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
        <p className="mb-2 text-sm text-yellow-400" role="status">
          No se pudo actualizar. Mostrando últimos datos disponibles.
        </p>
      )}

      <div
        className="divide-y divide-gray-200"
        role="grid"
        aria-label="Panel de acciones"
      >
        {rows.map((row) => (
          <Stock key={row.ticker} {...row} />
        ))}
      </div>
    </PanelContent>
  );
}