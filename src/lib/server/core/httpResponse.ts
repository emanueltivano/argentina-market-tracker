import 'server-only'

import { NextResponse } from 'next/server'
import { withRequestIdHeaders } from '@/lib/server/core/observability'

const NO_STORE_CACHE_CONTROL = 'no-store'

export function jsonNoStoreResponse(
  body: unknown,
  init: ResponseInit = {},
  requestId?: string
) {
  const headers = requestId
    ? withRequestIdHeaders(init.headers, requestId)
    : new Headers(init.headers)

  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', NO_STORE_CACHE_CONTROL)
  }

  return NextResponse.json(body, {
    ...init,
    headers,
  })
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
  requestId?: string
) {
  return jsonNoStoreResponse(body, init, requestId)
}
