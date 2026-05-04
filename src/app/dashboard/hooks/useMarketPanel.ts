import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import {
  type PanelResponse as MarketPanelResponse,
  type PanelTitulo,
} from '@/lib/panel';
import { type MarketPanelKey } from '@/lib/market';
import { getMarketPanelOption } from '../lib/panelOptions';
import { mapPanelTituloToStockProps } from '../components/panelMapper';

type MarketPanelSuccessResponse = Extract<MarketPanelResponse, { ok: true }>;
type MarketPanelErrorResponse = Extract<MarketPanelResponse, { ok: false }>;

const NUMERIC_PANEL_FIELDS = [
  'ultimoPrecio',
  'variacionPorcentual',
  'apertura',
  'maximo',
  'minimo',
  'ultimoCierre',
  'volumen',
] as const satisfies readonly (keyof PanelTitulo)[];

const PUNTA_FIELDS = [
  'cantidadCompra',
  'precioCompra',
  'precioVenta',
  'cantidadVenta',
] as const satisfies readonly (keyof NonNullable<PanelTitulo['puntas']>)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isPanelTitulo(value: unknown): value is PanelTitulo {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.simbolo) ||
    !isNonEmptyString(value.descripcion)
  ) {
    return false;
  }

  for (const field of NUMERIC_PANEL_FIELDS) {
    if (!isOptionalFiniteNumber(value[field])) {
      return false;
    }
  }

  const puntas = value.puntas;

  if (puntas === undefined) {
    return true;
  }

  if (!isRecord(puntas)) {
    return false;
  }

  return PUNTA_FIELDS.every((field) =>
    isOptionalFiniteNumber(puntas[field]),
  );
}

function getMarketPanelSuccessValidationError(value: unknown): string | null {
  if (!isRecord(value) || value.ok !== true) {
    return 'Respuesta inválida del servidor: contrato de éxito inválido.';
  }

  if (!Array.isArray(value.data)) {
    return 'Respuesta inválida del servidor: data debe ser un array.';
  }

  if (!value.data.every(isPanelTitulo)) {
    return 'Respuesta inválida del servidor: item de panel inválido.';
  }

  if (
    typeof value.fetchedAt !== 'string' ||
    typeof value.servedAt !== 'string' ||
    (value.cacheStatus !== 'fresh' && value.cacheStatus !== 'memory-cache')
  ) {
    return 'Respuesta inválida del servidor: metadata inválida.';
  }

  return null;
}

function isMarketPanelSuccessResponse(
  value: unknown,
): value is MarketPanelSuccessResponse {
  return getMarketPanelSuccessValidationError(value) === null;
}

function isMarketPanelErrorResponse(
  value: unknown,
): value is MarketPanelErrorResponse {
  return (
    isRecord(value) &&
    (value as { ok?: unknown }).ok === false &&
    typeof (value as { error?: unknown }).error === 'string'
  );
}

function panelErrorMessage(error: string): string {
  switch (error) {
    case 'PANEL_ERROR':
      return 'No se pudo cargar el panel de mercado.';
    case 'RATE_LIMITED':
      return 'Demasiadas solicitudes. Esperá unos segundos e intentá nuevamente.';
    case 'REFRESH_COOLDOWN':
      return 'Actualización reciente. Esperá unos segundos e intentá nuevamente.';
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

export const fetchMarketPanel = async (
  url: string,
): Promise<MarketPanelSuccessResponse> => {
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
    throw new Error(getMarketPanelSuccessValidationError(json) ?? 'Respuesta inválida del servidor');
  }

  return json;
};

export function useMarketPanel(activePanelKey: MarketPanelKey) {
  const activePanel = getMarketPanelOption(activePanelKey);

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    MarketPanelSuccessResponse,
    Error
  >(
    activePanel.fetchUrl,
    fetchMarketPanel,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: false,
      // SWR keeps current-key data while revalidating. Keeping this false avoids
      // rendering the previous panel's rows after the user switches panels.
      keepPreviousData: false,
      errorRetryCount: 1,
    },
  );

  const refresh = useCallback(async () => {
    const separator = activePanel.fetchUrl.includes('?') ? '&' : '?';

    await mutate(
      () => fetchMarketPanel(`${activePanel.fetchUrl}${separator}refresh=1`),
      {
        populateCache: true,
        revalidate: false,
      },
    );
  }, [activePanel.fetchUrl, mutate]);

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
    fetchedAt: data?.fetchedAt,
    servedAt: data?.servedAt,
    cacheStatus: data?.cacheStatus,
    refresh,
    isInitialLoading: isLoading && !hasData,
    isRefreshing: isValidating && hasData && !hasError,
    hasError,
    hasStaleError: hasError && hasData,
    isErrorWithoutData: hasError && !hasData,
    isEmpty: hasData && !hasError && !hasRows,
  };
}
