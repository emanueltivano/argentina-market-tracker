import 'server-only'

import { type NextRequest } from 'next/server'
import { ENV, getRuntimeEnvSummary } from '@/lib/server/core/env'
import { getHistoryCacheStats } from '@/lib/server/history/historyCache'
import {
  getObservabilitySnapshot,
  getRequestId,
  incrementMetricCounter,
  logServerWarn,
  withRequestIdHeaders,
} from '@/lib/server/core/observability'
import { getPanelCacheStats } from '@/lib/server/panel/panelCache'
import { jsonResponse } from '@/lib/server/panel/panelResponse'
import { getRateLimitRuntimeInfo } from '@/lib/server/core/rateLimit'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

function isDebugMetricsAuthorized(req: NextRequest) {
  if (ENV.NODE_ENV !== 'production') {
    return { allowed: true as const, reason: 'non-production' }
  }

  const configuredToken = ENV.OBSERVABILITY_DEBUG_TOKEN

  if (!configuredToken) {
    return { allowed: false as const, reason: 'disabled' }
  }

  const providedToken = req.headers.get('x-observability-token')?.trim() ?? ''

  if (providedToken && providedToken === configuredToken) {
    return { allowed: true as const, reason: 'token' }
  }

  return { allowed: false as const, reason: 'unauthorized' }
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  const auth = isDebugMetricsAuthorized(req)

  if (!auth.allowed) {
    incrementMetricCounter('api.request.total', 1, {
      endpoint: '/api/debug/metrics',
      method: 'GET',
      outcome: auth.reason,
      source: getRuntimeEnvSummary().marketDataSource,
      status: auth.reason === 'disabled' ? 404 : 401,
    })
    logServerWarn('api.debug.metrics.denied', {
      reason: auth.reason,
      requestId,
      route: '/api/debug/metrics',
    })

    if (auth.reason === 'disabled') {
      return jsonResponse(
        {
          ok: false,
          error: 'NOT_FOUND',
          requestId,
        },
        {
          status: 404,
          headers: withRequestIdHeaders(undefined, requestId),
        },
        requestId
      )
    }

    return jsonResponse(
      {
        ok: false,
        error: 'UNAUTHORIZED',
        requestId,
      },
      {
        status: 401,
        headers: withRequestIdHeaders(undefined, requestId),
      },
      requestId
    )
  }

  const runtimeEnv = getRuntimeEnvSummary()
  incrementMetricCounter('api.request.total', 1, {
    endpoint: '/api/debug/metrics',
    method: 'GET',
    outcome: 'success',
    source: runtimeEnv.marketDataSource,
    status: 200,
  })

  return jsonResponse(
    {
      ok: true,
      version: runtimeEnv.appVersion,
      dataSource: runtimeEnv.marketDataSource,
      metrics: getObservabilitySnapshot(),
      runtime: {
        historyCache: getHistoryCacheStats(),
        panelCache: getPanelCacheStats(),
        processLocal: true,
        rateLimit: getRateLimitRuntimeInfo(),
      },
    },
    {
      headers: withRequestIdHeaders(undefined, requestId),
    },
    requestId
  )
}
