import 'server-only'

import type { StockQuoteSuccessResponse } from '@/lib/stockQuote'
import type { StockHistoryMarket } from '@/lib/stockHistory'
import { ENV } from '@/lib/server/core/env'
import { incrementMetricCounter } from '@/lib/server/core/observability'

const STOCK_QUOTE_CACHE_MAX_KEYS = 500

type StockQuoteCacheEntry = {
  data: StockQuoteSuccessResponse['data']
  fetchedAt: string
  market: StockQuoteSuccessResponse['market']
  source: StockQuoteSuccessResponse['source']
  symbol: string
  freshUntil: number
  staleUntil: number
}

type StockQuoteNotFoundCacheEntry = {
  expiresAt: number
}

const stockQuoteCache = new Map<string, StockQuoteCacheEntry>()
const stockQuoteNotFoundCache = new Map<string, StockQuoteNotFoundCacheEntry>()
const inFlightStockQuoteRequests = new Map<
  string,
  Promise<StockQuoteSuccessResponse | null>
>()

function getCacheKey(market: StockHistoryMarket, symbol: string): string {
  return `${market.trim().toLowerCase()}:${symbol.trim().toUpperCase()}`
}

function pruneStockQuoteCache(now = Date.now()) {
  for (const [key, entry] of stockQuoteCache) {
    if (now >= entry.staleUntil) {
      stockQuoteCache.delete(key)
    }
  }

  for (const [key, entry] of stockQuoteNotFoundCache) {
    if (now >= entry.expiresAt) {
      stockQuoteNotFoundCache.delete(key)
    }
  }

  if (stockQuoteCache.size > STOCK_QUOTE_CACHE_MAX_KEYS) {
    const entriesByOldestExpiry = [...stockQuoteCache.entries()].sort(
      ([, first], [, second]) => first.staleUntil - second.staleUntil
    )

    for (const [key] of entriesByOldestExpiry.slice(
      0,
      stockQuoteCache.size - STOCK_QUOTE_CACHE_MAX_KEYS
    )) {
      stockQuoteCache.delete(key)
    }
  }

  if (stockQuoteNotFoundCache.size > STOCK_QUOTE_CACHE_MAX_KEYS) {
    const negativeEntriesByOldestExpiry = [
      ...stockQuoteNotFoundCache.entries(),
    ].sort(([, first], [, second]) => first.expiresAt - second.expiresAt)

    for (const [key] of negativeEntriesByOldestExpiry.slice(
      0,
      stockQuoteNotFoundCache.size - STOCK_QUOTE_CACHE_MAX_KEYS
    )) {
      stockQuoteNotFoundCache.delete(key)
    }
  }
}

export function hasCachedStockQuoteNotFound(
  market: StockHistoryMarket,
  symbol: string
): boolean {
  pruneStockQuoteCache()
  const cacheKey = getCacheKey(market, symbol)
  const cached = stockQuoteNotFoundCache.get(cacheKey)

  if (!cached || Date.now() >= cached.expiresAt) {
    stockQuoteNotFoundCache.delete(cacheKey)
    incrementMetricCounter('quote.negative_cache.event.total', 1, {
      event: 'miss',
      market,
    })
    return false
  }

  incrementMetricCounter('quote.negative_cache.event.total', 1, {
    event: 'hit',
    market,
  })
  return true
}

export function setCachedStockQuoteNotFound(
  market: StockHistoryMarket,
  symbol: string
) {
  stockQuoteNotFoundCache.set(getCacheKey(market, symbol), {
    expiresAt: Date.now() + ENV.STOCK_QUOTE_NOT_FOUND_TTL_MS,
  })
  pruneStockQuoteCache()
  incrementMetricCounter('quote.negative_cache.event.total', 1, {
    event: 'write',
    market,
  })
}

function buildCachedResponse(
  entry: StockQuoteCacheEntry,
  cacheStatus: StockQuoteSuccessResponse['cacheStatus'],
  now: number
): StockQuoteSuccessResponse {
  const stale = cacheStatus === 'stale'

  return {
    ok: true,
    data: entry.data,
    fetchedAt: entry.fetchedAt,
    servedAt: new Date(now).toISOString(),
    staleUntil: new Date(entry.staleUntil).toISOString(),
    cacheStatus,
    stale,
    ...(stale ? { degradationReason: 'upstream-unavailable' as const } : {}),
    source: entry.source,
    market: entry.market,
    symbol: entry.symbol,
  }
}

export function getCachedStockQuoteResponse(
  market: StockHistoryMarket,
  symbol: string
): StockQuoteSuccessResponse | null {
  const now = Date.now()
  pruneStockQuoteCache(now)

  const cacheKey = getCacheKey(market, symbol)
  const cached = stockQuoteCache.get(cacheKey)

  if (!cached || now >= cached.staleUntil) {
    stockQuoteCache.delete(cacheKey)
    incrementMetricCounter('quote.cache.event.total', 1, {
      event: 'miss',
      market,
    })
    return null
  }

  if (now >= cached.freshUntil) {
    incrementMetricCounter('quote.cache.event.total', 1, {
      event: 'stale-window-miss',
      market,
    })
    return null
  }

  incrementMetricCounter('quote.cache.event.total', 1, {
    event: 'hit',
    market,
  })
  return buildCachedResponse(cached, 'memory-cache', now)
}

export function getStaleStockQuoteResponse(
  market: StockHistoryMarket,
  symbol: string
): StockQuoteSuccessResponse | null {
  const now = Date.now()
  pruneStockQuoteCache(now)

  const cacheKey = getCacheKey(market, symbol)
  const cached = stockQuoteCache.get(cacheKey)

  if (!cached || now >= cached.staleUntil) {
    stockQuoteCache.delete(cacheKey)
    incrementMetricCounter('quote.cache.event.total', 1, {
      event: 'stale-miss',
      market,
    })
    return null
  }

  incrementMetricCounter('quote.cache.event.total', 1, {
    event: 'stale-hit',
    market,
  })
  return buildCachedResponse(cached, 'stale', now)
}

export function setCachedStockQuoteResponse(
  market: StockHistoryMarket,
  symbol: string,
  response: Pick<StockQuoteSuccessResponse, 'data' | 'source'>,
  now = Date.now()
): StockQuoteSuccessResponse {
  const cacheKey = getCacheKey(market, symbol)
  const normalizedSymbol = symbol.trim().toUpperCase()
  const freshUntil = now + ENV.STOCK_QUOTE_FRESH_TTL_MS
  const staleUntil = now + ENV.STOCK_QUOTE_STALE_TTL_MS
  const entry: StockQuoteCacheEntry = {
    data: response.data,
    fetchedAt: new Date(now).toISOString(),
    source: response.source,
    market,
    symbol: normalizedSymbol,
    freshUntil,
    staleUntil,
  }

  stockQuoteNotFoundCache.delete(cacheKey)
  stockQuoteCache.set(cacheKey, entry)
  pruneStockQuoteCache(now)
  incrementMetricCounter('quote.cache.event.total', 1, {
    event: 'write',
    market,
    source: response.source,
  })

  return buildCachedResponse(entry, 'fresh', now)
}

export function getOrCreateInFlightStockQuoteRequest(
  market: StockHistoryMarket,
  symbol: string,
  factory: () => Promise<StockQuoteSuccessResponse | null>
) {
  const cacheKey = getCacheKey(market, symbol)
  const inFlight = inFlightStockQuoteRequests.get(cacheKey)

  if (inFlight) {
    incrementMetricCounter('quote.cache.event.total', 1, {
      event: 'inflight-hit',
      market,
    })
    return inFlight
  }

  const promise = factory().finally(() => {
    if (inFlightStockQuoteRequests.get(cacheKey) === promise) {
      inFlightStockQuoteRequests.delete(cacheKey)
    }
  })

  inFlightStockQuoteRequests.set(cacheKey, promise)
  return promise
}

export function clearStockQuoteCacheForTests() {
  stockQuoteCache.clear()
  stockQuoteNotFoundCache.clear()
  inFlightStockQuoteRequests.clear()
}
