import {
  isStockQuoteErrorCode,
  isStockQuoteSuccessResponse,
  type StockQuoteResponse,
  type StockQuoteSuccessResponse,
} from '@/lib/stockQuote'
import {
  fetchValidatedJson,
  isJsonRecord,
} from '@/features/dashboard/shared/fetchJsonClient'

type StockQuoteErrorResponse = Extract<StockQuoteResponse, { ok: false }>

export class StockQuoteRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: StockQuoteErrorResponse['error'],
    public readonly retryAfterSec?: number
  ) {
    super(message)
    this.name = 'StockQuoteRequestError'
  }
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value.trim())) {
    return undefined
  }

  const seconds = Number(value)
  return Number.isSafeInteger(seconds) ? seconds : undefined
}

function isStockQuoteErrorResponse(
  value: unknown
): value is StockQuoteErrorResponse {
  return (
    isJsonRecord(value) &&
    value.ok === false &&
    isStockQuoteErrorCode(value.error)
  )
}

function assertStockQuoteSuccessResponse(
  value: unknown
): asserts value is StockQuoteSuccessResponse {
  if (!isStockQuoteSuccessResponse(value)) {
    throw new Error(
      'Respuesta inválida del servidor: contrato de cotización inválido.'
    )
  }
}

export async function getStockQuoteFetchError(
  response: Response,
  parsedJson?: unknown
): Promise<Error> {
  const retryAfterSec = parseRetryAfterSeconds(
    response.headers.get('Retry-After')
  )
  let json = parsedJson

  if (json === undefined) {
    try {
      json = await response.json()
    } catch {
      return new StockQuoteRequestError(
        `Error del servidor (${response.status}) al cargar la cotización.`,
        response.status,
        undefined,
        retryAfterSec
      )
    }
  }

  if (!isStockQuoteErrorResponse(json)) {
    return new StockQuoteRequestError(
      `Error del servidor (${response.status}) al cargar la cotización.`,
      response.status,
      undefined,
      retryAfterSec
    )
  }

  const messages: Record<StockQuoteErrorResponse['error'], string> = {
    RATE_LIMITED:
      'Demasiadas solicitudes. Esperá unos segundos e intentá nuevamente.',
    RATE_LIMIT_UNAVAILABLE:
      'El control de solicitudes no está disponible temporalmente.',
    QUOTE_ERROR: 'No se pudo cargar la cotización actual.',
    QUOTE_NOT_FOUND: 'No se encontró la cotización actual.',
    INVALID_SYMBOL: 'Símbolo inválido para cargar la cotización.',
    INVALID_MARKET: 'Mercado inválido para cargar la cotización.',
    METHOD_NOT_ALLOWED: 'Método no permitido para cargar la cotización.',
  }

  return new StockQuoteRequestError(
    messages[json.error],
    response.status,
    json.error,
    retryAfterSec
  )
}

export const fetchStockQuote = async (
  url: string
): Promise<StockQuoteSuccessResponse> =>
  fetchValidatedJson(url, {
    assertSuccessResponse: assertStockQuoteSuccessResponse,
    getError: getStockQuoteFetchError,
    invalidJsonMessage: `Respuesta inválida del servidor al cargar la cotización: ${url}`,
    parseBeforeHttpError: true,
  })
