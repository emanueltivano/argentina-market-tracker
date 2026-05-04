// src/app/dashboard/hooks/useMarketPanel.ts
import { useMemo } from 'react';
import useSWR from 'swr';
import { type PanelResponse as MarketPanelResponse } from '@/lib/panel';
import { type MarketPanelKey } from '@/lib/market';
import { getMarketPanelOption } from '../lib/panelOptions';
import { mapPanelTituloToStockProps } from '../components/panelMapper';

type MarketPanelSuccessResponse = Extract<MarketPanelResponse, { ok: true }>;
type MarketPanelErrorResponse = Extract<MarketPanelResponse, { ok: false }>;

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

function isMarketPanelErrorResponse(
  value: unknown,
): value is MarketPanelErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { ok?: unknown }).ok === false &&
    typeof (value as { error?: unknown }).error === 'string'
  );
}

function panelErrorMessage(error: string): string {
  switch (error) {
    case 'PANEL_ERROR':
      return 'No se pudo cargar el panel de mercado.';
    case 'METHOD_NOT_ALLOWED':
      return 'Método no permitido para cargar el panel.';
    default:
      return 'No se pudo cargar el panel.';
  }
}

export async function getMarketPanelFetchError(
  response: Response,
): Promise<Error> {
  let json: unknown;

  try {
    json = await response.json();
  } catch {
    return new Error(
      `Error del servidor (${response.status}) al cargar el panel.`,
    );
  }

  if (!isMarketPanelErrorResponse(json)) {
    return new Error(
      `Error del servidor (${response.status}) al cargar el panel.`,
    );
  }

  const message = panelErrorMessage(json.error);

  if (process.env.NODE_ENV !== 'production' && json.details) {
    return new Error(`${message} Detalle: ${json.details}`);
  }

  return new Error(message);
}

const fetcher = async (url: string): Promise<MarketPanelSuccessResponse> => {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw await getMarketPanelFetchError(response);
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
      // SWR keeps current-key data while revalidating. Keeping this false avoids
      // rendering the previous panel's rows after the user switches panels.
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
