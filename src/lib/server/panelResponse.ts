import 'server-only'

import { NextResponse } from 'next/server'
import type { PanelErrorCode, PanelErrorResponse } from '@/lib/panel'
import { withRequestIdHeaders } from '@/lib/server/observability'

const PANEL_CACHE_CONTROL = 'no-store'

export function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
  requestId?: string
) {
  const headers = requestId
    ? withRequestIdHeaders(init.headers, requestId)
    : new Headers(init.headers)

  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', PANEL_CACHE_CONTROL)
  }

  return NextResponse.json(body, {
    ...init,
    headers,
  })
}

export function panelErrorResponse(
  error: PanelErrorCode,
  init: ResponseInit,
  details?: string,
  requestId?: string
) {
  const body: PanelErrorResponse = {
    ok: false,
    error,
    ...(requestId ? { requestId } : {}),
    ...(details ? { details } : {}),
  }

  return jsonResponse(body, init, requestId)
}
