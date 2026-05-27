import type { NextRequest } from 'next/server'
import { ENV } from '@/lib/server/env'
import { parseFavoritesRequest } from '@/lib/server/favoritesRequest'
import {
  clearFavoritesRateLimitForTests,
  checkFavoritesRateLimit,
} from '@/lib/server/favoritesRateLimit'
import {
  clearFavoritesStateForTests,
  FavoritesLookupBatchError,
  getFavoritesResponse,
} from '@/lib/server/favoritesService'
import { jsonResponse } from '@/lib/server/panelResponse'
import {
  getRequestId,
  getSafeErrorDetails,
  incrementMetricCounter,
  logServerError,
  recordMetricDuration,
  withRequestIdHeaders,
} from '@/lib/server/observability'
import { getRetryAfterHeaders, safeCheckRateLimit } from '@/lib/server/rateLimit'
import type { FavoritesErrorCode, FavoritesErrorResponse } from '@/lib/favorites'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

function favoritesErrorResponse(
  error: FavoritesErrorCode,
  init: ResponseInit,
  details?: string,
  requestId?: string,
  options: {
    missingItems?: string[]
    failedItems?: string[]
  } = {}
) {
  const body: FavoritesErrorResponse = {
    ok: false,
    error,
    ...(requestId ? { requestId } : {}),
    ...(details ? { details } : {}),
    ...(options.missingItems ? { missingItems: options.missingItems } : {}),
    ...(options.failedItems ? { failedItems: options.failedItems } : {}),
  }

  return jsonResponse(body, init, requestId)
}

export function clearFavoritesCacheForTests() {
  clearFavoritesStateForTests()
  clearFavoritesRateLimitForTests()
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  const requestId = getRequestId(req)
  const parsedRequest = parseFavoritesRequest(req)
  const dataSource = ENV.MARKET_DATA_SOURCE

  if (!parsedRequest.ok) {
    const status = parsedRequest.error === 'TOO_MANY_ITEMS' ? 400 : 400

    incrementMetricCounter('api.request.total', 1, {
      endpoint: '/api/favorites',
      method: 'GET',
      outcome: 'error',
      source: dataSource,
      status,
    })
    recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
      endpoint: '/api/favorites',
      method: 'GET',
      status,
    })

    return favoritesErrorResponse(parsedRequest.error, { status }, undefined, requestId)
  }

  const rateLimitCheck = await safeCheckRateLimit(
    () => checkFavoritesRateLimit(req),
    {
      requestId,
      route: '/api/favorites',
    }
  )

  if (!rateLimitCheck.ok) {
    incrementMetricCounter('api.request.total', 1, {
      endpoint: '/api/favorites',
      method: 'GET',
      outcome: 'rate-limit-unavailable',
      source: dataSource,
      status: 503,
    })
    recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
      endpoint: '/api/favorites',
      method: 'GET',
      status: 503,
    })

    return favoritesErrorResponse(
      'RATE_LIMIT_UNAVAILABLE',
      {
        status: rateLimitCheck.status,
        headers: withRequestIdHeaders(
          { 'Retry-After': String(rateLimitCheck.retryAfterSec) },
          requestId
        ),
      },
      undefined,
      requestId
    )
  }

  const rateLimit = rateLimitCheck.rateLimit

  if (!rateLimit.ok) {
    incrementMetricCounter('api.request.total', 1, {
      endpoint: '/api/favorites',
      method: 'GET',
      outcome: 'rate-limited',
      source: dataSource,
      status: 429,
    })
    recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
      endpoint: '/api/favorites',
      method: 'GET',
      status: 429,
    })

    return favoritesErrorResponse(
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
    const response = await getFavoritesResponse(parsedRequest.items, {
      bypassCache: parsedRequest.bypassCache,
      requestId,
    })

    incrementMetricCounter('api.request.total', 1, {
      endpoint: '/api/favorites',
      method: 'GET',
      outcome: 'success',
      source: response.source,
      status: 200,
    })
    recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
      endpoint: '/api/favorites',
      method: 'GET',
      status: 200,
    })

    return jsonResponse(response, {
      headers: withRequestIdHeaders(rateLimit.headers, requestId),
    }, requestId)
  } catch (error: unknown) {
    const isProd = ENV.NODE_ENV === 'production'

    logServerError('api.favorites.GET', error, {
      requestId,
      route: '/api/favorites',
      items: parsedRequest.items.map((item) => `${item.market}:${item.symbol}`),
    })
    incrementMetricCounter('api.request.total', 1, {
      endpoint: '/api/favorites',
      method: 'GET',
      outcome: 'error',
      source: dataSource,
      status: 502,
    })
    recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
      endpoint: '/api/favorites',
      method: 'GET',
      status: 502,
    })

    return favoritesErrorResponse(
      'FAVORITES_ERROR',
      { status: 502 },
      isProd ? undefined : getSafeErrorDetails(error),
      requestId,
      error instanceof FavoritesLookupBatchError
        ? {
            missingItems: error.missingItems,
            failedItems: error.failedItems,
          }
        : {}
    )
  }
}

export function POST(req: NextRequest) {
  const requestId = getRequestId(req)

  incrementMetricCounter('api.request.total', 1, {
    endpoint: '/api/favorites',
    method: 'POST',
    outcome: 'method-not-allowed',
    source: ENV.MARKET_DATA_SOURCE,
    status: 405,
  })

  return favoritesErrorResponse(
    'METHOD_NOT_ALLOWED',
    {
      status: 405,
      headers: withRequestIdHeaders({ Allow: 'GET' }, requestId),
    },
    undefined,
    requestId
  )
}
