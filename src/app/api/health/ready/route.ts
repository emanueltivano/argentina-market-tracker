import 'server-only'

import { type NextRequest } from 'next/server'
import { jsonResponse } from '@/lib/server/core/httpResponse'
import {
  getRequestId,
  incrementMetricCounter,
  withRequestIdHeaders,
} from '@/lib/server/core/observability'
import { getRateLimitStoreReadiness } from '@/lib/server/core/rateLimit'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  const rateLimitStore = await getRateLimitStoreReadiness()
  const servedAt = new Date().toISOString()
  const isReady =
    !rateLimitStore.required || rateLimitStore.status === 'available'
  const statusCode = isReady ? 200 : 503

  incrementMetricCounter('api.request.total', 1, {
    endpoint: '/api/health/ready',
    method: 'GET',
    outcome: isReady ? 'success' : 'not-ready',
    status: statusCode,
  })

  return jsonResponse(
    {
      checkedAt: rateLimitStore.checkedAt ?? servedAt,
      dependencies: {
        rateLimitStore,
      },
      servedAt,
      status: isReady ? 'ready' : 'not-ready',
    },
    {
      headers: withRequestIdHeaders(undefined, requestId),
      status: statusCode,
    },
    requestId
  )
}
