'use client';

import { type ReactNode, useMemo, useState } from 'react';
import useSWR from 'swr';
import { type PanelResponse as MarketPanelResponse } from '@/lib/panel';
import { type MarketPanelKey } from '@/lib/market';
import NavStocks from './NavStocks';
import PanelMenu from './PanelMenu';
import Title from './PageTitle';
import Stock from './Stock';
import { mapPanelTituloToStockProps as mapMarketItemToStockProps } from './panelMapper';

type MarketPanelSuccessResponse = Extract<MarketPanelResponse, { ok: true }>;

type MarketPanelOption = {
  key: MarketPanelKey;
  label: string;
  title: string;
  fetchUrl: string;
};

type PanelProps = {
  defaultPanel?: MarketPanelKey;
};

const MARKET_PANEL_OPTIONS: MarketPanelOption[] = [
  {
    key: 'lider',
    label: 'Panel Líder',
    title: 'Panel Líder',
    fetchUrl: '/api/panel?type=lider',
  },
  {
    key: 'general',
    label: 'Panel General',
    title: 'Panel General',
    fetchUrl: '/api/panel?type=general',
  },
  {
    key: 'cedears',
    label: 'CEDEARs',
    title: 'CEDEARs',
    fetchUrl: '/api/panel?type=cedears',
  },
];

function isMarketPanelSuccessResponse(
  value: unknown,
): value is MarketPanelSuccessResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { ok?: unknown }).ok === true &&
    Array.isArray((value as { data?: unknown }).data)
  );
}

const fetcher = async (url: string): Promise<MarketPanelSuccessResponse> => {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`,
    );
  }

  let json: unknown;

  try {
    json = await response.json();
  } catch {
    throw new Error('Respuesta inválida del servidor');
  }

  if (!isMarketPanelSuccessResponse(json)) {
    throw new Error('Respuesta inválida del servidor');
  }

  return json;
};

export default function Panel({ defaultPanel = 'lider' }: PanelProps) {
  const [activePanelKey, setActivePanelKey] =
    useState<MarketPanelKey>(defaultPanel);

  const activePanel = getMarketPanelOption(activePanelKey);

  const { data, error, isLoading } = useSWR<MarketPanelSuccessResponse, Error>(
    activePanel.fetchUrl,
    fetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: false,
      keepPreviousData: false,
      errorRetryCount: 1,
    },
  );

  const rows = useMemo(
    () => (data?.data ?? []).map(mapMarketItemToStockProps),
    [data],
  );

  const hasError = !!error;
  const isEmpty = rows.length === 0;
  const isInitialError = hasError && !data;

  if (isInitialError) {
    return (
      <PanelContent
        title={activePanel.title}
        activePanelKey={activePanelKey}
        onChange={setActivePanelKey}
      >
        <p className='text-red-400'>Error cargando datos: {error.message}</p>
      </PanelContent>
    );
  }

  if (isLoading) {
    return (
      <PanelContent
        title={activePanel.title}
        activePanelKey={activePanelKey}
        onChange={setActivePanelKey}
      >
        <p className='text-gray-500' role='status'>
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
        onChange={setActivePanelKey}
      >
        {hasError && (
          <p className='mb-2 text-sm text-yellow-400' role='status'>
            No se pudo actualizar. Mostrando últimos datos disponibles.
          </p>
        )}

        <p className='text-gray-500' role='status'>
          No hay datos disponibles.
        </p>
      </PanelContent>
    );
  }

  return (
    <PanelContent
      title={activePanel.title}
      activePanelKey={activePanelKey}
      onChange={setActivePanelKey}
    >
      {hasError && (
        <p className='mb-2 text-sm text-yellow-400' role='status'>
          No se pudo actualizar. Mostrando últimos datos disponibles.
        </p>
      )}

      <div
        className='divide-y divide-gray-200'
        role='grid'
        aria-label='Panel de acciones'
      >
        {rows.map((row) => (
          <Stock key={row.ticker} {...row} />
        ))}
      </div>
    </PanelContent>
  );
}

function PanelContent({
  title,
  activePanelKey,
  onChange,
  children,
}: {
  title: string;
  activePanelKey: MarketPanelKey;
  onChange: (key: MarketPanelKey) => void;
  children: ReactNode;
}) {
  return (
    <section className='py-4'>
      <Title>{title}</Title>

      <PanelMenu
        activePanelKey={activePanelKey}
        onChange={onChange}
        options={MARKET_PANEL_OPTIONS}
      />

      <div className='overflow-x-auto'>
        <NavStocks />

        {children}
      </div>
    </section>
  );
}

function getMarketPanelOption(key: MarketPanelKey): MarketPanelOption {
  return (
    MARKET_PANEL_OPTIONS.find((option) => option.key === key) ??
    MARKET_PANEL_OPTIONS[0]
  );
}
