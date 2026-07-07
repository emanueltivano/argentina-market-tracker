import type { NextRequest } from 'next/server'
import { ENV } from '@/lib/server/core/env'
import { getDemoPanelData } from '@/lib/server/demo/demoMarketData'
import { iolFetch } from '@/lib/server/upstream/iol'
import {
  getRequestId,
  getSafeErrorDetails,
  incrementMetricCounter,
  logServerError,
  recordMetricDuration,
  withRequestIdHeaders,
} from '@/lib/server/core/observability'
import { getPanelEndpoint } from '@/lib/server/panel/panelEndpoint'
import {
  clearPanelResponseCacheForTests,
  getOrCreatePanelResponse,
  hasInFlightPanelRefresh,
} from '@/lib/server/panel/panelCache'
import {
  checkPanelRateLimit,
  checkPanelRefreshCooldown,
  clearPanelLimitsForTests,
} from '@/lib/server/panel/panelLimits'
import {
  getPanelType,
  shouldBypassPanelCache,
  shouldReturnRawPanelData,
} from '@/lib/server/panel/panelRequest'
import { jsonResponse } from '@/lib/server/core/httpResponse'
import { panelErrorResponse } from '@/lib/server/panel/panelResponse'
import { getRetryAfterHeaders, safeCheckRateLimit } from '@/lib/server/core/rateLimit'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const PANEL_ROUTE = '/api/panel'

function recordPanelRequest(
  startedAt: number,
  status: number,
  outcome: string,
  source: string
) {
  incrementMetricCounter('api.request.total', 1, {
    endpoint: PANEL_ROUTE,
    method: 'GET',
    outcome,
    source,
    status,
  })
  recordMetricDuration('api.request.duration_ms', Date.now() - startedAt, {
    endpoint: PANEL_ROUTE,
    method: 'GET',
    status,
  })
}

function rateLimitUnavailableResponse(
  status: number,
  retryAfterSec: number,
  requestId: string
) {
  return panelErrorResponse(
    'RATE_LIMIT_UNAVAILABLE',
    {
      status,
      headers: withRequestIdHeaders(
        { 'Retry-After': String(retryAfterSec) },
        requestId
      ),
    },
    undefined,
    requestId
  )
}

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
    recordPanelRequest(startedAt, 400, 'error', dataSource)
    return panelErrorResponse('INVALID_PANEL_TYPE', { status: 400 }, undefined, requestId)
  }

  const type = panelType.type
  const shouldReturnRaw = shouldReturnRawPanelData(req)
  const bypassCache = shouldBypassPanelCache(req)
  const rateLimitCheck = await safeCheckRateLimit(() => checkPanelRateLimit(req), {
    requestId,
    route: PANEL_ROUTE,
  })

  if (!rateLimitCheck.ok) {
    recordPanelRequest(startedAt, 503, 'rate-limit-unavailable', dataSource)
    return rateLimitUnavailableResponse(
      rateLimitCheck.status,
      rateLimitCheck.retryAfterSec,
      requestId
    )
  }

  const rateLimit = rateLimitCheck.rateLimit

  if (!rateLimit.ok) {
    recordPanelRequest(startedAt, 429, 'rate-limited', dataSource)
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
        route: PANEL_ROUTE,
      }
    )

    if (!refreshCooldownCheck.ok) {
      recordPanelRequest(startedAt, 503, 'rate-limit-unavailable', dataSource)
      return rateLimitUnavailableResponse(
        refreshCooldownCheck.status,
        refreshCooldownCheck.retryAfterSec,
        requestId
      )
    }

    const refreshCooldown = refreshCooldownCheck.rateLimit

    if (!refreshCooldown.ok) {
      recordPanelRequest(startedAt, 429, 'cooldown-blocked', dataSource)
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
      recordPanelRequest(startedAt, 200, 'success', dataSource)

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
    recordPanelRequest(startedAt, 200, 'success', dataSource)

    return jsonResponse(response, {
      headers: withRequestIdHeaders(rateLimit.headers, requestId),
    }, requestId)
  } catch (err: unknown) {
    const isProd = ENV.NODE_ENV === 'production'

    logServerError('api.panel.GET', err, {
      requestId,
      route: PANEL_ROUTE,
      panelType: type,
      bypassCache,
      shouldReturnRaw,
    })
    recordPanelRequest(startedAt, 502, 'error', dataSource)

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
    endpoint: PANEL_ROUTE,
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
