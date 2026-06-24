import 'server-only'

import { type NextRequest } from 'next/server'
import {
  DEFAULT_STOCK_HISTORY_MARKET,
  DEFAULT_STOCK_HISTORY_RANGE,
  isStockHistoryMarket,
  isStockHistoryRange,
  type StockHistoryErrorCode,
  type StockHistoryMarket,
  type StockHistoryRange,
} from '@/lib/stockHistory'

export type HistoryRouteParams = Awaited<Promise<{ symbol: string }>>

function isValidSymbol(value: string): boolean {
  return /^[A-Z0-9._-]{1,20}$/.test(value)
}

function decodeHistorySymbol(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

type ParsedHistoryRequest =
  | {
      ok: true
      symbol: string
      market: StockHistoryMarket
      range: StockHistoryRange
    }
  | {
      ok: false
      error: Extract<
        StockHistoryErrorCode,
        'INVALID_SYMBOL' | 'INVALID_MARKET' | 'INVALID_RANGE'
      >
    }

export function parseHistoryRequest(
  req: NextRequest,
  params: HistoryRouteParams
): ParsedHistoryRequest {
  const decodedSymbol = decodeHistorySymbol(params.symbol)
  const symbol = decodedSymbol?.trim().toUpperCase() ?? ''
  const market = (
    req.nextUrl.searchParams.get('market') ?? DEFAULT_STOCK_HISTORY_MARKET
  ).trim()
  const range =
    req.nextUrl.searchParams.get('range') ?? DEFAULT_STOCK_HISTORY_RANGE

  if (!isValidSymbol(symbol)) {
    return {
      ok: false,
      error: 'INVALID_SYMBOL',
    }
  }

  if (!isStockHistoryMarket(market)) {
    return {
      ok: false,
      error: 'INVALID_MARKET',
    }
  }

  if (!isStockHistoryRange(range)) {
    return {
      ok: false,
      error: 'INVALID_RANGE',
    }
  }

  return {
    ok: true,
    symbol,
    market,
    range,
  }
}
