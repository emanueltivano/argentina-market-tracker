import { type NextRequest } from 'next/server'
import { ENV } from '@/lib/server/core/env'
import { jsonNoStoreResponse } from '@/lib/server/core/httpResponse'
import {
  getRequestId,
  getSafeErrorDetails,
  logServerError,
  withRequestIdHeaders,
} from '@/lib/server/core/observability'
import { getStockQuoteResponse } from '@/lib/server/quote/quoteService'
import { IolUpstreamHttpError } from '@/lib/server/upstream/iol'
import {
  DEFAULT_STOCK_HISTORY_MARKET,
  isStockHistoryMarket,
} from '@/lib/stockHistory'
import type { StockQuoteErrorCode } from '@/lib/stockQuote'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ symbol: string }>
}

function errorResponse(
  error: StockQuoteErrorCode,
  status: number,
  requestId: string,
  details?: string
) {
  return jsonNoStoreResponse(
    {
      ok: false,
      error,
      requestId,
      ...(details ? { details } : {}),
    },
    {
      status,
      headers: withRequestIdHeaders(undefined, requestId),
    },
    requestId
  )
}

function normalizeSymbol(value: string): string | null {
  try {
    const symbol = decodeURIComponent(value).trim().toUpperCase()

    return /^[A-Z0-9._-]{1,20}$/.test(symbol) ? symbol : null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const requestId = getRequestId(req)
  const params = await context.params
  const symbol = normalizeSymbol(params.symbol)
  const market = (
    req.nextUrl.searchParams.get('market') ?? DEFAULT_STOCK_HISTORY_MARKET
  ).trim()

  if (!symbol) {
    return errorResponse('INVALID_SYMBOL', 400, requestId)
  }

  if (!isStockHistoryMarket(market)) {
    return errorResponse('INVALID_MARKET', 400, requestId)
  }

  try {
    const response = await getStockQuoteResponse(symbol, market)

    if (!response) {
      return errorResponse('QUOTE_NOT_FOUND', 404, requestId)
    }

    return jsonNoStoreResponse(response, undefined, requestId)
  } catch (error: unknown) {
    if (error instanceof IolUpstreamHttpError && error.status === 404) {
      return errorResponse('QUOTE_NOT_FOUND', 404, requestId)
    }

    logServerError('api.stocks.quote.GET', error, {
      requestId,
      route: '/api/stocks/[symbol]/quote',
      symbol,
      market,
    })

    return errorResponse(
      'QUOTE_ERROR',
      502,
      requestId,
      ENV.NODE_ENV === 'production' ? undefined : getSafeErrorDetails(error)
    )
  }
}

export function POST(req: NextRequest) {
  const requestId = getRequestId(req)

  return errorResponse('METHOD_NOT_ALLOWED', 405, requestId)
}
