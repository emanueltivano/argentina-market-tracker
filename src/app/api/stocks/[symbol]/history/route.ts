import { type NextRequest } from 'next/server'
import { ENV } from '@/lib/server/env'
import { parseHistoryRequest } from '@/lib/server/historyRequest'
import { checkHistoryRateLimit } from '@/lib/server/historyRateLimit'
import { historyErrorResponse, jsonHistoryResponse } from '@/lib/server/historyResponse'
import {
  getHistoryCacheSizeForTests as getHistoryCacheSize,
  getOrCreateHistoryResponse,
  logHistoryRequestParams,
} from '@/lib/server/historyService'
import { logServerError } from '@/lib/server/observability'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ symbol: string }>
}

export function getHistoryCacheSizeForTests() {
  return getHistoryCacheSize()
}

export async function GET(req: NextRequest, context: RouteContext) {
  const params = await context.params
  const parsedRequest = parseHistoryRequest(req, params)

  logHistoryRequestParams({
    rawParams: params,
    symbolParam: params.symbol,
    normalizedSymbol: parsedRequest.ok ? parsedRequest.symbol : null,
    rangeParam: req.nextUrl.searchParams.get('range'),
    normalizedRange: parsedRequest.ok ? parsedRequest.range : null,
    marketParam: req.nextUrl.searchParams.get('market'),
    normalizedMarket: parsedRequest.ok ? parsedRequest.market : null,
    url: req.nextUrl.pathname + req.nextUrl.search,
  })

  if (!parsedRequest.ok) {
    return historyErrorResponse(parsedRequest.error, { status: 400 })
  }

  const rateLimit = checkHistoryRateLimit(req)

  if (!rateLimit.ok) {
    return historyErrorResponse('RATE_LIMITED', {
      status: 429,
      headers: {
        'Retry-After': String(rateLimit.retryAfterSec),
      },
    })
  }

  try {
    return jsonHistoryResponse(
      await getOrCreateHistoryResponse(
        parsedRequest.symbol,
        parsedRequest.market,
        parsedRequest.range
      )
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? 'unknown')
    const isProd = ENV.NODE_ENV === 'production'

    logServerError('api.stocks.history.GET', err, {
      route: '/api/stocks/[symbol]/history',
      symbol: parsedRequest.symbol,
      market: parsedRequest.market,
      range: parsedRequest.range,
    })

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
