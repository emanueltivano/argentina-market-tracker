import {
  isPanelErrorCode,
  type PanelErrorCode,
  type PanelResponse as MarketPanelResponse,
} from '@/lib/panel';
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
    isPanelErrorCode((value as { error?: unknown }).error)
  );
}

const PANEL_ERROR_MESSAGE: Record<PanelErrorCode, string> = {
  PANEL_ERROR: 'No se pudo cargar el panel de mercado.',
  RATE_LIMITED: 'Demasiadas solicitudes. Esperá unos segundos e intentá nuevamente.',
  REFRESH_COOLDOWN: 'Actualización reciente. Esperá unos segundos e intentá nuevamente.',
  METHOD_NOT_ALLOWED: 'Método no permitido para cargar el panel.',
  INVALID_PANEL_TYPE: 'Panel de mercado inválido.',
};

function panelErrorMessage(error: PanelErrorCode): string {
  switch (error) {
    case 'PANEL_ERROR':
    case 'RATE_LIMITED':
    case 'REFRESH_COOLDOWN':
    case 'METHOD_NOT_ALLOWED':
    case 'INVALID_PANEL_TYPE':
      return PANEL_ERROR_MESSAGE[error];
  }
}

function panelRequestTarget(response: Response): string {
  return response.url ? ` (${response.url})` : '';
}

export async function getMarketPanelFetchError(
  response: Response,
): Promise<Error> {
  let json: unknown;

  try {
    json = await response.json();
  } catch {
    return new Error(
      `Error del servidor (${response.status}) al cargar el panel${panelRequestTarget(response)}.`,
    );
  }

  if (!isMarketPanelErrorResponse(json)) {
    return new Error(
      `Error del servidor (${response.status}) al cargar el panel${panelRequestTarget(response)}.`,
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
    throw new Error(`Respuesta inválida del servidor al cargar el panel: ${url}`);
  }

  assertMarketPanelSuccessResponse(json);

  return json;
};
