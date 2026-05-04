// src/app/dashboard/hooks/useMarketPanel.ts
import { useMemo } from 'react';
import useSWR from 'swr';
import { type PanelResponse as MarketPanelResponse } from '@/lib/panel';
import { type MarketPanelKey } from '@/lib/market';
import { getMarketPanelOption } from '../lib/panelOptions';
import { mapPanelTituloToStockProps } from '../components/panelMapper';

type MarketPanelSuccessResponse = Extract<MarketPanelResponse, { ok: true }>;

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

export function useMarketPanel(activePanelKey: MarketPanelKey) {
  const activePanel = getMarketPanelOption(activePanelKey);

  const { data, error, isLoading, isValidating } = useSWR<
    MarketPanelSuccessResponse,
    Error
  >(
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
    () => (data?.data ?? []).map(mapPanelTituloToStockProps),
    [data],
  );
  const hasData = data !== undefined;
  const hasRows = rows.length > 0;
  const hasError = !!error;

  return {
    activePanel,
    rows,
    error,
    isInitialLoading: isLoading && !hasData,
    isRefreshing: isValidating && hasData && !hasError,
    hasError,
    hasStaleError: hasError && hasData,
    isErrorWithoutData: hasError && !hasData,
    isEmpty: hasData && !hasError && !hasRows,
  };
}
