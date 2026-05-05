import { type PanelResponse as MarketPanelResponse } from '@/lib/panel';
import { assertMarketPanelSuccessResponse } from './marketPanelValidation';

export type MarketPanelSuccessResponse = Extract<
  MarketPanelResponse,
  { ok: true }
>;

type MarketPanelErrorResponse = Extract<MarketPanelResponse, { ok: false }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
    case 'INVALID_PANEL_TYPE':
      return 'Panel de mercado inválido.';
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

  assertMarketPanelSuccessResponse(json);

  return json;
};
