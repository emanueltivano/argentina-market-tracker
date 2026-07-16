import 'server-only'

import { type NextRequest } from 'next/server'
import { jsonResponse } from '@/lib/server/core/httpResponse'
import {
  getRequestId,
  incrementMetricCounter,
  withRequestIdHeaders,
} from '@/lib/server/core/observability'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  const checkedAt = new Date().toISOString()

  incrementMetricCounter('api.request.total', 1, {
    endpoint: '/api/health/live',
    method: 'GET',
    outcome: 'success',
    status: 200,
  })

  return jsonResponse(
    {
      checkedAt,
      service: 'application',
      status: 'ok',
    },
    {
      headers: withRequestIdHeaders(undefined, requestId),
    },
    requestId
  )
}
