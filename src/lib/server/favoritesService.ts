import 'server-only'

import {
  buildFavoriteLookupKey,
  type FavoriteLookupItem,
  type FavoritesSuccessResponse,
} from '@/lib/favorites'
import { normalizeQuoteData, type PanelTitulo } from '@/lib/panel'
import {
  getDemoQuoteBySymbol,
} from '@/lib/server/demoMarketData'
import { ENV } from '@/lib/server/env'
import { getQuoteBySymbol, IolUpstreamHttpError } from '@/lib/server/iol'
import {
  clearQuoteCacheForTests,
  getCachedQuote,
  getOrCreateInFlightQuoteRequest,
  getStaleQuote,
  setCachedQuote,
} from '@/lib/server/quoteCache'
import {
  getSafeErrorDetails,
  incrementMetricCounter,
  logServerWarn,
} from './observability'
import type { StockHistoryMarket } from '@/lib/stockHistory'

type FavoriteQuoteResolution =
  | {
      kind: 'row'
      itemKey: string
      row: PanelTitulo
      fetchedAt: string
      stale: boolean
    }
  | {
      kind: 'missing'
      itemKey: string
    }
  | {
      kind: 'failed'
      itemKey: string
      reason: string
    }

export class FavoritesLookupBatchError extends Error {
  constructor(
    message: string,
    public readonly failedItems: string[],
    public readonly missingItems: string[]
  ) {
    super(message)
    this.name = 'FavoritesLookupBatchError'
  }
}

async function fetchLiveQuote(
  market: StockHistoryMarket,
  symbol: string,
  requestId?: string
) {
  const fetchedAt = new Date().toISOString()
  const data = await getQuoteBySymbol(market, symbol, { requestId })
  const row = normalizeQuoteData(data, { symbol })

  const value = {
    data: row,
    fetchedAt,
  }

  setCachedQuote(market, symbol, value)
  return value
}

async function getQuoteRow(
  market: StockHistoryMarket,
  symbol: string,
  options: {
    bypassCache: boolean
    requestId?: string
  }
): Promise<FavoriteQuoteResolution> {
  const itemKey = buildFavoriteLookupKey({ market, symbol })

  if (ENV.MARKET_DATA_SOURCE === 'demo') {
    const demoQuote = getDemoQuoteBySymbol(symbol)

    return demoQuote
      ? {
          kind: 'row',
          itemKey,
          row: demoQuote,
          fetchedAt: new Date().toISOString(),
          stale: false,
        }
      : {
          kind: 'missing',
          itemKey,
        }
  }

  if (!options.bypassCache) {
    const cached = getCachedQuote(market, symbol)

    if (cached) {
      return {
        kind: 'row',
        itemKey,
        row: cached.data,
        fetchedAt: cached.fetchedAt,
        stale: false,
      }
    }
  }

  try {
    const value = await getOrCreateInFlightQuoteRequest(market, symbol, () =>
      fetchLiveQuote(market, symbol, options.requestId)
    )

    return {
      kind: 'row',
      itemKey,
      row: value.data,
      fetchedAt: value.fetchedAt,
      stale: false,
    }
  } catch (error: unknown) {
    const stale = getStaleQuote(market, symbol)

    if (stale) {
      logServerWarn('favorites.quote.stale-fallback', {
        requestId: options.requestId,
        market,
        symbol,
        reason: getSafeErrorDetails(error),
      })

      return {
        kind: 'row',
        itemKey,
        row: stale.data,
        fetchedAt: stale.fetchedAt,
        stale: true,
      }
    }

    if (
      error instanceof IolUpstreamHttpError &&
      error.status === 404
    ) {
      return {
        kind: 'missing',
        itemKey,
      }
    }

    logServerWarn('favorites.quote.lookup.failed', {
      requestId: options.requestId,
      market,
      symbol,
      reason: getSafeErrorDetails(error),
      status:
        error instanceof IolUpstreamHttpError
          ? error.status
          : undefined,
      upstreamPath:
        error instanceof IolUpstreamHttpError
          ? error.upstreamPath
          : undefined,
    })

    return {
      kind: 'failed',
      itemKey,
      reason: getSafeErrorDetails(error) ?? 'unknown',
    }
  }
}

export async function getFavoritesResponse(
  items: FavoriteLookupItem[],
  options: {
    bypassCache: boolean
    requestId?: string
  }
): Promise<FavoritesSuccessResponse> {
  const results = await Promise.all(
    items.map((item) =>
      getQuoteRow(item.market, item.symbol, {
        bypassCache: options.bypassCache,
        requestId: options.requestId,
      })
    )
  )

  const rows: PanelTitulo[] = []
  const missingItems: string[] = []
  const failedItems: string[] = []
  let updatedAt = new Date(0).toISOString()
  let stale = false

  for (const result of results) {
    if (result.kind === 'row') {
      rows.push(result.row)
      stale ||= result.stale

      if (result.fetchedAt > updatedAt) {
        updatedAt = result.fetchedAt
      }

      continue
    }

    if (result.kind === 'missing') {
      missingItems.push(result.itemKey)
      continue
    }

    failedItems.push(result.itemKey)
  }

  if (rows.length === 0 && failedItems.length > 0) {
    throw new FavoritesLookupBatchError(
      `Favorites quote lookup failed for: ${failedItems.join(', ')}`,
      failedItems,
      missingItems
    )
  }

  incrementMetricCounter('favorites.response.total', 1, {
    source: ENV.MARKET_DATA_SOURCE,
    stale,
  })

  return {
    ok: true,
    rows,
    missingItems,
    failedItems,
    source: ENV.MARKET_DATA_SOURCE,
    requestId: options.requestId,
    updatedAt,
    servedAt: new Date().toISOString(),
    stale,
  }
}

export function clearFavoritesStateForTests() {
  clearQuoteCacheForTests()
}
