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
  let json = parsedJson

  if (json === undefined) {
    try {
      json = await response.json()
    } catch {
      return new Error(
        `Error del servidor (${response.status}) al cargar la cotización.`
      )
    }
  }

  if (!isStockQuoteErrorResponse(json)) {
    return new Error(
      `Error del servidor (${response.status}) al cargar la cotización.`
    )
  }

  const messages: Record<StockQuoteErrorResponse['error'], string> = {
    QUOTE_ERROR: 'No se pudo cargar la cotización actual.',
    QUOTE_NOT_FOUND: 'No se encontró la cotización actual.',
    INVALID_SYMBOL: 'Símbolo inválido para cargar la cotización.',
    INVALID_MARKET: 'Mercado inválido para cargar la cotización.',
    METHOD_NOT_ALLOWED: 'Método no permitido para cargar la cotización.',
  }

  return new Error(messages[json.error])
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
