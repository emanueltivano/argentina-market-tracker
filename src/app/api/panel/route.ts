import type { NextRequest } from 'next/server'
import { ENV } from '@/lib/server/env'
import { getDemoPanelData } from '@/lib/server/demoMarketData'
import { iolFetch } from '@/lib/server/iol'
import {
  getRequestId,
  getSafeErrorDetails,
  incrementMetricCounter,
  logServerError,
  recordMetricDuration,
  withRequestIdHeaders,
} from '@/lib/server/observability'
import { getPanelEndpoint } from '@/lib/server/panelEndpoint'
import {
  clearPanelResponseCacheForTests,
  getOrCreatePanelResponse,
  hasInFlightPanelRefresh,
} from '@/lib/server/panelCache'
import {
  checkPanelRateLimit,
  checkPanelRefreshCooldown,
  clearPanelLimitsForTests,
} from '@/lib/server/panelLimits'
import {
  getPanelType,
  shouldBypassPanelCache,
  shouldReturnRawPanelData,
} from '@/lib/server/panelRequest'
import { jsonResponse, panelErrorResponse } from '@/lib/server/panelResponse'
import { getRetryAfterHeaders, safeCheckRateLimit } from '@/lib/server/rateLimit'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export function clearPanelCacheForTests() {
  clearPanelResponseCacheForTests()
  clearPanelLimitsForTests()
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  const requestId = getRequestId(req)
  const panelType = getPanelType(req)
  const dataSource = ENV.MARKET_DATA_SOURCE

  if (!panelType.ok) {
    incrementMetricCounter('api.request.total', 1, {
      endpoint: '/api/panel',
      method: 'GET',
      outcome: 'error',
      source: dataSource,
      status: 400,
    })
    recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
      endpoint: '/api/panel',
      method: 'GET',
      status: 400,
    })
    return panelErrorResponse('INVALID_PANEL_TYPE', { status: 400 }, undefined, requestId)
  }

  const type = panelType.type
  const shouldReturnRaw = shouldReturnRawPanelData(req)
  const bypassCache = shouldBypassPanelCache(req)
  const rateLimitCheck = await safeCheckRateLimit(() => checkPanelRateLimit(req), {
    requestId,
    route: '/api/panel',
  })

  if (!rateLimitCheck.ok) {
    incrementMetricCounter('api.request.total', 1, {
      endpoint: '/api/panel',
      method: 'GET',
      outcome: 'rate-limit-unavailable',
      source: dataSource,
      status: 503,
    })
    recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
      endpoint: '/api/panel',
      method: 'GET',
      status: 503,
    })

    return panelErrorResponse(
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
      endpoint: '/api/panel',
      method: 'GET',
      outcome: 'rate-limited',
      source: dataSource,
      status: 429,
    })
    recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
      endpoint: '/api/panel',
      method: 'GET',
      status: 429,
    })
    return panelErrorResponse('RATE_LIMITED', {
      status: 429,
      headers: withRequestIdHeaders(getRetryAfterHeaders(rateLimit), requestId),
    }, undefined, requestId)
  }

  // Local in-memory cooldown for manual refresh. In serverless this protects
  // only the current instance; it is not a global distributed limit.
  if (bypassCache && !hasInFlightPanelRefresh(type)) {
    const refreshCooldownCheck = await safeCheckRateLimit(
      () => checkPanelRefreshCooldown(req, type),
      {
        requestId,
        route: '/api/panel',
      }
    )

    if (!refreshCooldownCheck.ok) {
      incrementMetricCounter('api.request.total', 1, {
        endpoint: '/api/panel',
        method: 'GET',
        outcome: 'rate-limit-unavailable',
        source: dataSource,
        status: 503,
      })
      recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
        endpoint: '/api/panel',
        method: 'GET',
        status: 503,
      })

      return panelErrorResponse(
        'RATE_LIMIT_UNAVAILABLE',
        {
          status: refreshCooldownCheck.status,
          headers: withRequestIdHeaders(
            { 'Retry-After': String(refreshCooldownCheck.retryAfterSec) },
            requestId
          ),
        },
        undefined,
        requestId
      )
    }

    const refreshCooldown = refreshCooldownCheck.rateLimit

    if (!refreshCooldown.ok) {
      incrementMetricCounter('api.request.total', 1, {
        endpoint: '/api/panel',
        method: 'GET',
        outcome: 'cooldown-blocked',
        source: dataSource,
        status: 429,
      })
      recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
        endpoint: '/api/panel',
        method: 'GET',
        status: 429,
      })
      return panelErrorResponse('REFRESH_COOLDOWN', {
        status: 429,
        headers: withRequestIdHeaders(
          getRetryAfterHeaders(refreshCooldown),
          requestId
        ),
      }, undefined, requestId)
    }
  }

  try {
    if (shouldReturnRaw) {
      const data =
        ENV.MARKET_DATA_SOURCE === 'demo'
          ? getDemoPanelData(type)
          : await iolFetch(getPanelEndpoint(type))
      incrementMetricCounter('api.request.total', 1, {
        endpoint: '/api/panel',
        method: 'GET',
        outcome: 'success',
        source: dataSource,
        status: 200,
      })
      recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
        endpoint: '/api/panel',
        method: 'GET',
        status: 200,
      })

      return jsonResponse(
        {
          ok: true,
          type,
          data,
        },
        {
          headers: withRequestIdHeaders(rateLimit.headers, requestId),
        },
        requestId
      )
    }

    const response = await getOrCreatePanelResponse(type, bypassCache)
    incrementMetricCounter('panel.response.total', 1, {
      cacheStatus: response.cacheStatus,
      panelType: type,
      source: dataSource,
    })
    incrementMetricCounter('api.request.total', 1, {
      endpoint: '/api/panel',
      method: 'GET',
      outcome: 'success',
      source: dataSource,
      status: 200,
    })
    recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
      endpoint: '/api/panel',
      method: 'GET',
      status: 200,
    })

    return jsonResponse(response, {
      headers: withRequestIdHeaders(rateLimit.headers, requestId),
    }, requestId)
  } catch (err: unknown) {
    const isProd = ENV.NODE_ENV === 'production'

    logServerError('api.panel.GET', err, {
      requestId,
      route: '/api/panel',
      panelType: type,
      bypassCache,
      shouldReturnRaw,
    })
    incrementMetricCounter('api.request.total', 1, {
      endpoint: '/api/panel',
      method: 'GET',
      outcome: 'error',
      source: dataSource,
      status: 502,
    })
    recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
      endpoint: '/api/panel',
      method: 'GET',
      status: 502,
    })

    return panelErrorResponse(
      'PANEL_ERROR',
      { status: 502 },
      isProd ? undefined : getSafeErrorDetails(err),
      requestId
    )
  }
}

export function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  incrementMetricCounter('api.request.total', 1, {
    endpoint: '/api/panel',
    method: 'POST',
    outcome: 'method-not-allowed',
    source: ENV.MARKET_DATA_SOURCE,
    status: 405,
  })

  return panelErrorResponse(
    'METHOD_NOT_ALLOWED',
    {
      status: 405,
      headers: withRequestIdHeaders({ Allow: 'GET' }, requestId),
    },
    undefined,
    requestId
  )
}
