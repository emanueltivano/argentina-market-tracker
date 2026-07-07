import 'server-only'

import { ENV } from '@/lib/server/core/env'
import { getDemoQuoteDetailBySymbol } from '@/lib/server/demo/demoMarketData'
import { iolFetch } from '@/lib/server/upstream/iol'
import { getQuoteDetailEndpoint } from '@/lib/server/upstream/quoteEndpoint'
import {
  normalizeStockQuoteDetail,
  type StockQuoteSuccessResponse,
} from '@/lib/stockQuote'
import type { StockHistoryMarket } from '@/lib/stockHistory'

export async function getStockQuoteResponse(
  symbol: string,
  market: StockHistoryMarket
): Promise<StockQuoteSuccessResponse | null> {
  const fetchedAt = new Date().toISOString()

  if (ENV.MARKET_DATA_SOURCE === 'demo') {
    const data = getDemoQuoteDetailBySymbol(symbol, market)

    return data
      ? {
          ok: true,
          data,
          fetchedAt,
          servedAt: new Date().toISOString(),
          source: 'demo',
          market,
          symbol,
        }
      : null
  }

  const payload = await iolFetch(getQuoteDetailEndpoint(market, symbol))
  const data = normalizeStockQuoteDetail(payload, symbol)

  return {
    ok: true,
    data,
    fetchedAt,
    servedAt: new Date().toISOString(),
    source: 'live',
    market,
    symbol,
  }
}
