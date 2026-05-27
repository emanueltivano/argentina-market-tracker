import {
  isStockHistoryErrorCode,
  isStockHistoryMarket,
  isStockHistoryPoint,
  isStockHistoryRange,
  type StockHistoryErrorCode,
  type StockHistoryResponse,
  type StockHistorySuccessResponse,
} from '@/lib/stockHistory'

type StockHistoryErrorResponse = Extract<StockHistoryResponse, { ok: false }>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStockHistoryErrorResponse(
  value: unknown
): value is StockHistoryErrorResponse {
  return (
    isRecord(value) &&
    value.ok === false &&
    isStockHistoryErrorCode(value.error)
  )
}

function assertStockHistorySuccessResponse(
  value: unknown
): asserts value is StockHistorySuccessResponse {
  if (!isRecord(value) || value.ok !== true) {
    throw new Error('Respuesta inválida del servidor: contrato de históricos inválido.')
  }

  if (!Array.isArray(value.data) || !value.data.every(isStockHistoryPoint)) {
    throw new Error('Respuesta inválida del servidor: históricos inválidos.')
  }

  if (
    typeof value.fetchedAt !== 'string' ||
    typeof value.servedAt !== 'string' ||
    (value.cacheStatus !== 'fresh' && value.cacheStatus !== 'memory-cache') ||
    !isStockHistoryRange(typeof value.range === 'string' ? value.range : null) ||
    !isStockHistoryMarket(typeof value.market === 'string' ? value.market : null) ||
    typeof value.symbol !== 'string'
  ) {
    throw new Error('Respuesta inválida del servidor: metadata histórica inválida.')
  }

  if (
    !isRecord(value.meta) ||
    typeof value.meta.discardedPoints !== 'number' ||
    typeof value.meta.totalPoints !== 'number' ||
    typeof value.meta.stale !== 'boolean' ||
    (value.meta.source !== 'demo' && value.meta.source !== 'live') ||
    (value.meta.requestId !== undefined && typeof value.meta.requestId !== 'string')
  ) {
    throw new Error('Respuesta inválida del servidor: meta histórica inválida.')
  }
}

const HISTORY_ERROR_MESSAGE: Record<StockHistoryErrorCode, string> = {
  HISTORY_ERROR: 'No se pudo cargar el histórico.',
  INVALID_SYMBOL: 'Símbolo inválido para cargar histórico.',
  INVALID_MARKET: 'Mercado inválido para cargar histórico.',
  INVALID_RANGE: 'Rango inválido para cargar histórico.',
  RATE_LIMITED: 'Demasiadas solicitudes. Esperá unos segundos e intentá nuevamente.',
  METHOD_NOT_ALLOWED: 'Método no permitido para cargar histórico.',
}

function historyErrorMessage(error: StockHistoryErrorCode): string {
  switch (error) {
    case 'HISTORY_ERROR':
    case 'INVALID_SYMBOL':
    case 'INVALID_MARKET':
    case 'INVALID_RANGE':
    case 'RATE_LIMITED':
    case 'METHOD_NOT_ALLOWED':
      return HISTORY_ERROR_MESSAGE[error]
  }
}

function historyRequestTarget(response: Response): string {
  return response.url ? ` (${response.url})` : ''
}

export async function getStockHistoryFetchError(
  response: Response,
  parsedJson?: unknown
): Promise<Error> {
  let json: unknown = parsedJson

  if (json === undefined) {
    try {
      json = await response.json()
    } catch {
      return new Error(
        `Error del servidor (${response.status}) al cargar el histórico${historyRequestTarget(response)}.`
      )
    }
  }

  if (!isStockHistoryErrorResponse(json)) {
    return new Error(
      `Error del servidor (${response.status}) al cargar el histórico${historyRequestTarget(response)}.`
    )
  }

  const message = historyErrorMessage(json.error)

  if (process.env.NODE_ENV !== 'production' && json.details) {
    return new Error(`${message} Detalle: ${json.details}`)
  }

  return new Error(message)
}

export const fetchStockHistory = async (
  url: string
): Promise<StockHistorySuccessResponse> => {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  })

  let json: unknown

  try {
    json = await response.json()
  } catch {
    throw new Error(`Respuesta inválida del servidor al cargar el histórico: ${url}`)
  }

  if (!response.ok) {
    throw await getStockHistoryFetchError(response, json)
  }

  assertStockHistorySuccessResponse(json)

  return json
}
