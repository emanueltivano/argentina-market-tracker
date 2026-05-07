import { NextResponse, type NextRequest } from 'next/server'
import { ENV } from '@/lib/server/env'
import { iolFetch } from '@/lib/server/iol'
import {
  isStockHistoryRange,
  normalizeStockHistoryData,
  type StockHistoryErrorCode,
  type StockHistoryErrorResponse,
  type StockHistoryRange,
  type StockHistoryResponse,
  type StockHistorySuccessResponse,
} from '@/lib/stockHistory'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const HISTORY_CACHE_TTL_MS = 5 * 60_000
const HISTORY_CACHE_CONTROL = 'no-store'
const DEFAULT_MARKET = 'bCBA'
const DEFAULT_RANGE: StockHistoryRange = '1M'

type HistoryVariant = 'ajustada' | 'sinAjustar'

type HistoryCacheEntry = {
  response: StockHistorySuccessResponse
  expiresAt: number
}

type RouteContext = {
  params: Promise<{ symbol: string }>
}

const historyCache = new Map<string, HistoryCacheEntry>()
const inFlightHistoryRequests = new Map<string, Promise<StockHistoryResponse>>()

const RANGE_DAYS: Record<StockHistoryRange, number> = {
  '1W': 7,
  '1M': 31,
  '3M': 93,
  '6M': 186,
  '1Y': 365,
}

const JSON_HEADERS = {
  'Cache-Control': HISTORY_CACHE_CONTROL,
}

function devLog(...args: unknown[]) {
  if (ENV.NODE_ENV !== 'production') {
    console.log('[stock-history]', ...args)
  }
}

function isValidSymbol(value: string): boolean {
  return /^[A-Z0-9._-]{1,20}$/.test(value)
}

function isValidMarket(value: string): boolean {
  return /^[A-Za-z0-9._-]{1,20}$/.test(value)
}

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getDateRange(range: StockHistoryRange, now = new Date()) {
  const fechaHasta = toDateInput(now)
  const desde = new Date(now)

  desde.setUTCDate(desde.getUTCDate() - RANGE_DAYS[range])

  return {
    fechaDesde: toDateInput(desde),
    fechaHasta,
  }
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value)
}

function getHistoryEndpoint(
  market: string,
  symbol: string,
  range: StockHistoryRange,
  variant: HistoryVariant
): string {
  const { fechaDesde, fechaHasta } = getDateRange(range)

  return `/api/v2/${encodePathPart(market)}/Titulos/${encodePathPart(
    symbol
  )}/Cotizacion/seriehistorica/${fechaDesde}/${fechaHasta}/${variant}`
}

function createHistoryResponse(
  data: StockHistorySuccessResponse['data'],
  symbol: string,
  market: string,
  range: StockHistoryRange,
  fetchedAt: string,
  cacheStatus: StockHistorySuccessResponse['cacheStatus']
): StockHistorySuccessResponse {
  return {
    ok: true,
    data,
    fetchedAt,
    servedAt: new Date().toISOString(),
    cacheStatus,
    range,
    market,
    symbol,
  }
}

function getCacheKey(
  symbol: string,
  market: string,
  range: StockHistoryRange
): string {
  return `${market}:${symbol}:${range}`
}

function getCachedHistoryResponse(cacheKey: string): StockHistoryResponse | null {
  const cached = historyCache.get(cacheKey)

  if (!cached || Date.now() >= cached.expiresAt) {
    historyCache.delete(cacheKey)
    return null
  }

  return {
    ...cached.response,
    servedAt: new Date().toISOString(),
    cacheStatus: 'memory-cache',
  }
}

function setCachedHistoryResponse(
  cacheKey: string,
  response: StockHistoryResponse
) {
  if (!response.ok) {
    return
  }

  historyCache.set(cacheKey, {
    response,
    expiresAt: Date.now() + HISTORY_CACHE_TTL_MS,
  })
}

async function fetchAndNormalizeHistoryVariant(
  cacheKey: string,
  symbol: string,
  market: string,
  range: StockHistoryRange,
  variant: HistoryVariant
): Promise<{
  endpoint: string
  normalizedData: StockHistorySuccessResponse['data']
  variant: HistoryVariant
}> {
  const endpoint = getHistoryEndpoint(market, symbol, range, variant)

  devLog('iol-request', { cacheKey, symbol, market, range, variant, endpoint })

  const data = await iolFetch(endpoint)
  const normalizedData = normalizeStockHistoryData(data)

  devLog('normalized', {
    cacheKey,
    symbol,
    market,
    range,
    variant,
    endpoint,
    itemCount: normalizedData.length,
  })

  return {
    endpoint,
    normalizedData,
    variant,
  }
}

async function fetchHistoryResponse(
  cacheKey: string,
  symbol: string,
  market: string,
  range: StockHistoryRange
): Promise<StockHistoryResponse> {
  const adjustedResult = await fetchAndNormalizeHistoryVariant(
    cacheKey,
    symbol,
    market,
    range,
    'ajustada'
  )
  const result =
    adjustedResult.normalizedData.length > 0
      ? adjustedResult
      : await fetchAndNormalizeHistoryVariant(
          cacheKey,
          symbol,
          market,
          range,
          'sinAjustar'
        )
  const fetchedAt = new Date().toISOString()

  devLog('selected-variant', {
    cacheKey,
    symbol,
    market,
    range,
    variant: result.variant,
    endpoint: result.endpoint,
    itemCount: result.normalizedData.length,
  })

  const response = createHistoryResponse(
    result.normalizedData,
    symbol,
    market,
    range,
    fetchedAt,
    'fresh'
  )

  setCachedHistoryResponse(cacheKey, response)
  return response
}

function getOrCreateHistoryResponse(
  symbol: string,
  market: string,
  range: StockHistoryRange
): Promise<StockHistoryResponse> {
  const cacheKey = getCacheKey(symbol, market, range)
  const cached = getCachedHistoryResponse(cacheKey)

  if (cached) {
    return Promise.resolve(cached)
  }

  const inFlight = inFlightHistoryRequests.get(cacheKey)

  if (inFlight) {
    return inFlight
  }

  const promise = fetchHistoryResponse(cacheKey, symbol, market, range).finally(
    () => {
      if (inFlightHistoryRequests.get(cacheKey) === promise) {
        inFlightHistoryRequests.delete(cacheKey)
      }
    }
  )

  inFlightHistoryRequests.set(cacheKey, promise)
  return promise
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)

  for (const [key, value] of Object.entries(JSON_HEADERS)) {
    if (!headers.has(key)) {
      headers.set(key, value)
    }
  }

  return NextResponse.json(body, {
    ...init,
    headers,
  })
}

function historyErrorResponse(
  error: StockHistoryErrorCode,
  init: ResponseInit,
  details?: string
) {
  const body: StockHistoryErrorResponse = {
    ok: false,
    error,
    ...(details ? { details } : {}),
  }

  return jsonResponse(body, init)
}

export function clearHistoryCacheForTests() {
  historyCache.clear()
  inFlightHistoryRequests.clear()
}

export async function GET(req: NextRequest, context: RouteContext) {
  const params = await context.params
  const symbol = decodeURIComponent(params.symbol).trim().toUpperCase()
  const rangeParam = req.nextUrl.searchParams.get('range')
  const market = (req.nextUrl.searchParams.get('market') ?? DEFAULT_MARKET).trim()
  const range = rangeParam ?? DEFAULT_RANGE

  devLog('params', {
    rawParams: params,
    symbolParam: params.symbol,
    normalizedSymbol: symbol,
    rangeParam,
    normalizedRange: range,
    marketParam: req.nextUrl.searchParams.get('market'),
    normalizedMarket: market,
    url: req.nextUrl.pathname + req.nextUrl.search,
  })

  if (!isValidSymbol(symbol)) {
    return historyErrorResponse('INVALID_SYMBOL', { status: 400 })
  }

  if (!isValidMarket(market)) {
    return historyErrorResponse('INVALID_MARKET', { status: 400 })
  }

  if (!isStockHistoryRange(range)) {
    return historyErrorResponse('INVALID_RANGE', { status: 400 })
  }

  try {
    return jsonResponse(await getOrCreateHistoryResponse(symbol, market, range))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? 'unknown')
    const isProd = ENV.NODE_ENV === 'production'

    return historyErrorResponse(
      'HISTORY_ERROR',
      { status: 502 },
      isProd ? undefined : message
    )
  }
}

export function POST() {
  return historyErrorResponse(
    'METHOD_NOT_ALLOWED',
    {
      status: 405,
      headers: { Allow: 'GET' },
    }
  )
}
