import 'server-only'

import {
  getCachedHistoryResponse,
  getHistoryCacheSizeForTests as getHistoryCacheSize,
  getOrCreateInFlightHistoryRequest,
  setCachedHistoryResponse,
} from '@/lib/server/historyCache'
import { getHistoryEndpoint, type HistoryVariant } from '@/lib/server/historyEndpoint'
import { iolFetch } from '@/lib/server/iol'
import { createHistoryResponse } from '@/lib/server/historyResponse'
import {
  normalizeStockHistoryData,
  type StockHistoryMarket,
  type StockHistoryRange,
  type StockHistoryResponse,
  type StockHistorySuccessResponse,
} from '@/lib/stockHistory'
import { ENV } from './env'

function devLog(...args: unknown[]) {
  if (ENV.NODE_ENV !== 'production') {
    console.log('[stock-history]', ...args)
  }
}

async function fetchAndNormalizeHistoryVariant(
  symbol: string,
  market: StockHistoryMarket,
  range: StockHistoryRange,
  variant: HistoryVariant
): Promise<{
  endpoint: string
  normalizedData: StockHistorySuccessResponse['data']
  variant: HistoryVariant
}> {
  const endpoint = getHistoryEndpoint(market, symbol, range, variant)

  devLog('iol-request', { symbol, market, range, variant, endpoint })

  const data = await iolFetch(endpoint)
  const normalizedData = normalizeStockHistoryData(data)

  devLog('normalized', {
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
  symbol: string,
  market: StockHistoryMarket,
  range: StockHistoryRange
): Promise<StockHistoryResponse> {
  const adjustedResult = await fetchAndNormalizeHistoryVariant(
    symbol,
    market,
    range,
    'ajustada'
  )
  const result =
    adjustedResult.normalizedData.length > 0
      ? adjustedResult
      : await fetchAndNormalizeHistoryVariant(
          symbol,
          market,
          range,
          'sinAjustar'
        )
  const fetchedAt = new Date().toISOString()

  devLog('selected-variant', {
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

  setCachedHistoryResponse(symbol, market, range, response)
  return response
}

export function getOrCreateHistoryResponse(
  symbol: string,
  market: StockHistoryMarket,
  range: StockHistoryRange
): Promise<StockHistoryResponse> {
  const cached = getCachedHistoryResponse(symbol, market, range)

  if (cached) {
    return Promise.resolve(cached)
  }

  return getOrCreateInFlightHistoryRequest(symbol, market, range, () =>
    fetchHistoryResponse(symbol, market, range)
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
