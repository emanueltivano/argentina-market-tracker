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
import {
  getRequestId,
  getSafeErrorDetails,
  incrementMetricCounter,
  logServerError,
  recordMetricDuration,
  withRequestIdHeaders,
} from '@/lib/server/observability'
import { getRetryAfterHeaders } from '@/lib/server/rateLimit'

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
  const startedAt = Date.now()
  const requestId = getRequestId(req)
  const params = await context.params
  const parsedRequest = parseHistoryRequest(req, params)
  const dataSource = ENV.MARKET_DATA_SOURCE

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
    incrementMetricCounter('api.request.total', 1, {
      endpoint: '/api/stocks/[symbol]/history',
      method: 'GET',
      outcome: 'error',
      source: dataSource,
      status: 400,
    })
    recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
      endpoint: '/api/stocks/[symbol]/history',
      method: 'GET',
      status: 400,
    })
    return historyErrorResponse(
      parsedRequest.error,
      { status: 400 },
      undefined,
      requestId
    )
  }

  const maybeRateLimit = checkHistoryRateLimit(req)
  const rateLimit =
    maybeRateLimit instanceof Promise ? await maybeRateLimit : maybeRateLimit

  if (!rateLimit.ok) {
    incrementMetricCounter('api.request.total', 1, {
      endpoint: '/api/stocks/[symbol]/history',
      method: 'GET',
      outcome: 'rate-limited',
      source: dataSource,
      status: 429,
    })
    recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
      endpoint: '/api/stocks/[symbol]/history',
      method: 'GET',
      status: 429,
    })
    return historyErrorResponse(
      'RATE_LIMITED',
      {
        status: 429,
        headers: withRequestIdHeaders(getRetryAfterHeaders(rateLimit), requestId),
      },
      undefined,
      requestId
    )
  }

  try {
    const response = await getOrCreateHistoryResponse(
      parsedRequest.symbol,
      parsedRequest.market,
      parsedRequest.range,
      { requestId }
    )
    incrementMetricCounter('api.request.total', 1, {
      endpoint: '/api/stocks/[symbol]/history',
      method: 'GET',
      outcome: 'success',
      source: response.meta.source,
      status: 200,
    })
    recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
      endpoint: '/api/stocks/[symbol]/history',
      method: 'GET',
      status: 200,
    })

    return jsonHistoryResponse(
      {
        ...response,
        meta: {
          ...response.meta,
          requestId,
        },
      },
      {
        headers: withRequestIdHeaders(rateLimit.headers, requestId),
      },
      requestId
    )
  } catch (err: unknown) {
    const isProd = ENV.NODE_ENV === 'production'

    logServerError('api.stocks.history.GET', err, {
      requestId,
      route: '/api/stocks/[symbol]/history',
      symbol: parsedRequest.symbol,
      market: parsedRequest.market,
      range: parsedRequest.range,
    })
    incrementMetricCounter('api.request.total', 1, {
      endpoint: '/api/stocks/[symbol]/history',
      method: 'GET',
      outcome: 'error',
      source: dataSource,
      status: 502,
    })
    recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
      endpoint: '/api/stocks/[symbol]/history',
      method: 'GET',
      status: 502,
    })

    return historyErrorResponse(
      'HISTORY_ERROR',
      { status: 502 },
      isProd ? undefined : getSafeErrorDetails(err),
      requestId
    )
  }
}

export function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  incrementMetricCounter('api.request.total', 1, {
    endpoint: '/api/stocks/[symbol]/history',
    method: 'POST',
    outcome: 'method-not-allowed',
    source: ENV.MARKET_DATA_SOURCE,
    status: 405,
  })

  return historyErrorResponse(
    'METHOD_NOT_ALLOWED',
    {
      status: 405,
      headers: withRequestIdHeaders({ Allow: 'GET' }, requestId),
    },
    undefined,
    requestId
  )
}
