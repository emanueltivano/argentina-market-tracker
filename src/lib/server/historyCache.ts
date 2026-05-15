import 'server-only'

import {
  type StockHistoryMarket,
  type StockHistoryRange,
  type StockHistoryResponse,
  type StockHistorySuccessResponse,
} from '@/lib/stockHistory'

const HISTORY_CACHE_TTL_MS = 5 * 60_000
const HISTORY_CACHE_MAX_KEYS = 500

type HistoryCacheEntry = {
  response: StockHistorySuccessResponse
  expiresAt: number
}

const historyCache = new Map<string, HistoryCacheEntry>()
const inFlightHistoryRequests = new Map<string, Promise<StockHistoryResponse>>()

function getCacheKey(
  symbol: string,
  market: StockHistoryMarket,
  range: StockHistoryRange
): string {
  return `${market}:${symbol}:${range}`
}

function pruneHistoryCache(now = Date.now()) {
  for (const [key, entry] of historyCache) {
    if (now >= entry.expiresAt) {
      historyCache.delete(key)
    }
  }

  if (historyCache.size <= HISTORY_CACHE_MAX_KEYS) {
    return
  }

  const entriesByOldestExpiry = [...historyCache.entries()].sort(
    ([, first], [, second]) => first.expiresAt - second.expiresAt
  )

  for (const [key] of entriesByOldestExpiry.slice(
    0,
    historyCache.size - HISTORY_CACHE_MAX_KEYS
  )) {
    historyCache.delete(key)
  }
}

export function getCachedHistoryResponse(
  symbol: string,
  market: StockHistoryMarket,
  range: StockHistoryRange
): StockHistoryResponse | null {
  pruneHistoryCache()

  const cacheKey = getCacheKey(symbol, market, range)
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

export function setCachedHistoryResponse(
  symbol: string,
  market: StockHistoryMarket,
  range: StockHistoryRange,
  response: StockHistoryResponse
) {
  if (!response.ok) {
    return
  }

  historyCache.set(getCacheKey(symbol, market, range), {
    response,
    expiresAt: Date.now() + HISTORY_CACHE_TTL_MS,
  })
  pruneHistoryCache()
}

export function getOrCreateInFlightHistoryRequest(
  symbol: string,
  market: StockHistoryMarket,
  range: StockHistoryRange,
  factory: () => Promise<StockHistoryResponse>
) {
  const cacheKey = getCacheKey(symbol, market, range)
  const inFlight = inFlightHistoryRequests.get(cacheKey)

  if (inFlight) {
    return inFlight
  }

  const promise = factory().finally(() => {
    if (inFlightHistoryRequests.get(cacheKey) === promise) {
      inFlightHistoryRequests.delete(cacheKey)
    }
  })

  inFlightHistoryRequests.set(cacheKey, promise)
  return promise
}

export function getHistoryCacheSizeForTests() {
  pruneHistoryCache()
  return historyCache.size
}
