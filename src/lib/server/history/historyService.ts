import 'server-only'

import {
  getCachedHistoryResponse,
  getStaleHistoryResponse,
  getHistoryCacheSizeForTests as getHistoryCacheSize,
  getOrCreateInFlightHistoryRequest,
  setCachedHistoryResponse,
} from '@/lib/server/history/historyCache'
import { getDemoHistoryData } from '@/lib/server/demo/demoMarketData'
import { getHistoryEndpoint, type HistoryVariant } from '@/lib/server/history/historyEndpoint'
import { iolFetch } from '@/lib/server/upstream/iol'
import { createHistoryResponse } from '@/lib/server/history/historyResponse'
import {
  normalizeStockHistoryDataResult,
  type StockHistoryMarket,
  type StockHistoryRange,
  type StockHistoryResponseMeta,
  type StockHistorySuccessResponse,
} from '@/lib/stockHistory'
import { ENV } from '@/lib/server/core/env'
import {
  getSafeErrorDetails,
  incrementMetricCounter,
  logServerInfo,
  logServerWarn,
} from '@/lib/server/core/observability'

function devLog(...args: unknown[]) {
  if (ENV.NODE_ENV !== 'production') {
    logServerInfo('stock-history', { args })
  }
}

async function fetchAndNormalizeHistoryVariant(
  symbol: string,
  market: StockHistoryMarket,
  range: StockHistoryRange,
  variant: HistoryVariant,
  requestId?: string
): Promise<{
  discardedPoints: number
  endpoint: string
  normalizedData: StockHistorySuccessResponse['data']
  totalPoints: number
  variant: HistoryVariant
}> {
  const endpoint = getHistoryEndpoint(market, symbol, range, variant)

  devLog('iol-request', { symbol, market, range, variant, endpoint })

  const data = await iolFetch(endpoint)
  const normalized = normalizeStockHistoryDataResult(data)

  if (normalized.discardedPoints > 0) {
    logServerWarn('history.normalize.partial', {
      requestId,
      symbol,
      market,
      range,
      variant,
      endpoint,
      discardedPoints: normalized.discardedPoints,
      totalPoints: normalized.totalPoints,
    })
    incrementMetricCounter('history.discarded_points.total', normalized.discardedPoints, {
      market,
      range,
      variant,
    })
  }

  devLog('normalized', {
    symbol,
    market,
    range,
    variant,
    endpoint,
    itemCount: normalized.data.length,
    discardedPoints: normalized.discardedPoints,
  })

  return {
    endpoint,
    normalizedData: normalized.data,
    discardedPoints: normalized.discardedPoints,
    totalPoints: normalized.totalPoints,
    variant,
  }
}

function buildHistoryMeta(options: {
  discardedPoints: number
  source: StockHistoryResponseMeta['source']
  stale: boolean
  totalPoints: number
}): StockHistoryResponseMeta {
  return {
    discardedPoints: options.discardedPoints,
    source: options.source,
    stale: options.stale,
    totalPoints: options.totalPoints,
  }
}

async function fetchHistoryResponse(
  symbol: string,
  market: StockHistoryMarket,
  range: StockHistoryRange,
  requestId?: string
): Promise<StockHistorySuccessResponse> {
  if (ENV.MARKET_DATA_SOURCE === 'demo') {
    const fetchedAt = new Date().toISOString()
    const data = getDemoHistoryData(symbol, market, range)
    const response = createHistoryResponse(
      data,
      symbol,
      market,
      range,
      fetchedAt,
      'fresh',
      buildHistoryMeta({
        discardedPoints: 0,
        source: 'demo',
        stale: false,
        totalPoints: data.length,
      })
    )

    setCachedHistoryResponse(symbol, market, range, response)
    incrementMetricCounter('history.response.total', 1, {
      cacheStatus: response.cacheStatus,
      source: 'demo',
      stale: false,
    })
    return response
  }

  try {
    const adjustedResult = await fetchAndNormalizeHistoryVariant(
      symbol,
      market,
      range,
      'ajustada',
      requestId
    )
    const result =
      adjustedResult.normalizedData.length > 0
        ? adjustedResult
        : await fetchAndNormalizeHistoryVariant(
            symbol,
            market,
            range,
            'sinAjustar',
            requestId
          )
    const fetchedAt = new Date().toISOString()
    incrementMetricCounter('history.variant.selected.total', 1, {
      market,
      range,
      variant: result.variant,
    })

    devLog('selected-variant', {
      symbol,
      market,
      range,
      variant: result.variant,
      endpoint: result.endpoint,
      itemCount: result.normalizedData.length,
      discardedPoints: result.discardedPoints,
    })

    const response = createHistoryResponse(
      result.normalizedData,
      symbol,
      market,
      range,
      fetchedAt,
      'fresh',
      buildHistoryMeta({
        discardedPoints: result.discardedPoints,
        source: 'live',
        stale: false,
        totalPoints: result.totalPoints,
      })
    )

    setCachedHistoryResponse(symbol, market, range, response)
    incrementMetricCounter('history.response.total', 1, {
      cacheStatus: response.cacheStatus,
      source: 'live',
      stale: false,
    })
    return response
  } catch (error: unknown) {
    const staleFallback = getStaleHistoryResponse(symbol, market, range)

    if (!staleFallback) {
      throw error
    }

    logServerWarn('history.stale-fallback', {
      requestId,
      symbol,
      market,
      range,
      reason: getSafeErrorDetails(error),
      cachedPoints: staleFallback.data.length,
    })
    incrementMetricCounter('history.stale_fallback.total', 1, {
      market,
      range,
      source: staleFallback.meta.source,
    })
    incrementMetricCounter('history.response.total', 1, {
      cacheStatus: staleFallback.cacheStatus,
      source: staleFallback.meta.source,
      stale: true,
    })

    return staleFallback
  }
}

export function getOrCreateHistoryResponse(
  symbol: string,
  market: StockHistoryMarket,
  range: StockHistoryRange,
  options: {
    requestId?: string
  } = {}
): Promise<StockHistorySuccessResponse> {
  const cached = getCachedHistoryResponse(symbol, market, range)

  if (cached) {
    return Promise.resolve(cached)
  }

  return getOrCreateInFlightHistoryRequest(symbol, market, range, () =>
    fetchHistoryResponse(symbol, market, range, options.requestId)
  )
}

export function logHistoryRequestParams(context: {
  rawParams: unknown
  symbolParam: string
  normalizedSymbol: string | null
  rangeParam: string | null
  normalizedRange: string | null
  marketParam: string | null
  normalizedMarket: string | null
  url: string
}) {
  devLog('params', context)
}

export function getHistoryCacheSizeForTests() {
  return getHistoryCacheSize()
}
