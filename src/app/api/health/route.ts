import 'server-only'

import { type NextRequest } from 'next/server'
import { getRuntimeEnvSummary } from '@/lib/server/env'
import { getHistoryCacheStats } from '@/lib/server/historyCache'
import {
  getApproximateUptimeMs,
  getRequestId,
  incrementMetricCounter,
  withRequestIdHeaders,
} from '@/lib/server/observability'
import { getPanelCacheStats } from '@/lib/server/panelCache'
import { jsonResponse } from '@/lib/server/panelResponse'
import { getRateLimitRuntimeInfo } from '@/lib/server/rateLimit'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  const runtimeEnv = getRuntimeEnvSummary()
  const rateLimit = getRateLimitRuntimeInfo()
  const isDegraded =
    runtimeEnv.marketDataSource === 'invalid' ||
    runtimeEnv.missingLiveConfig.length > 0 ||
    rateLimit.status !== 'ok'

  incrementMetricCounter('api.request.total', 1, {
    endpoint: '/api/health',
    method: 'GET',
    outcome: isDegraded ? 'degraded' : 'success',
    source: runtimeEnv.marketDataSource,
    status: 200,
  })

  return jsonResponse(
    {
      ok: true,
      status: isDegraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptimeMs: getApproximateUptimeMs(),
      version: runtimeEnv.appVersion,
      dataSource: runtimeEnv.marketDataSource,
      checks: {
        config:
          runtimeEnv.marketDataSource === 'live'
            ? {
                missingLiveConfig: runtimeEnv.missingLiveConfig,
                status:
                  runtimeEnv.missingLiveConfig.length > 0 ? 'degraded' : 'ok',
              }
            : {
                missingLiveConfig: [],
                status: runtimeEnv.marketDataSource === 'invalid' ? 'degraded' : 'ok',
              },
        historyCache: {
          status: 'ok',
          ...getHistoryCacheStats(),
        },
        metrics: {
          debugEndpointEnabled:
            runtimeEnv.nodeEnv !== 'production' ||
            runtimeEnv.metricsDebugTokenConfigured,
          processLocal: true,
          status: 'ok',
        },
        panelCache: {
          status: 'ok',
          ...getPanelCacheStats(),
        },
        rateLimit: {
          status: rateLimit.status,
          configuredStore: rateLimit.configuredStore,
          storeMode: rateLimit.storeMode,
          trustedProxy: rateLimit.trustedProxy,
          ...(rateLimit.reasons.length > 0 ? { reasons: rateLimit.reasons } : {}),
          ...(!rateLimit.ok ? { details: rateLimit.error } : {}),
        },
      },
    },
    {
      headers: withRequestIdHeaders(undefined, requestId),
    },
    requestId
  )
}
