import 'server-only'

import { NextResponse } from 'next/server'
import {
  type StockHistoryErrorCode,
  type StockHistoryErrorResponse,
  type StockHistoryMarket,
  type StockHistoryRange,
  type StockHistorySuccessResponse,
} from '@/lib/stockHistory'

const HISTORY_CACHE_CONTROL = 'no-store'
const JSON_HEADERS = {
  'Cache-Control': HISTORY_CACHE_CONTROL,
}

export function createHistoryResponse(
  data: StockHistorySuccessResponse['data'],
  symbol: string,
  market: StockHistoryMarket,
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

export function jsonHistoryResponse(body: unknown, init: ResponseInit = {}) {
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

export function historyErrorResponse(
  error: StockHistoryErrorCode,
  init: ResponseInit,
  details?: string
) {
  const body: StockHistoryErrorResponse = {
    ok: false,
    error,
    ...(details ? { details } : {}),
  }

  return jsonHistoryResponse(body, init)
}
