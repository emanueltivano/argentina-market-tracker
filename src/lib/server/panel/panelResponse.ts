import 'server-only'

import type { PanelErrorCode, PanelErrorResponse } from '@/lib/panel'
import { jsonNoStoreResponse } from '@/lib/server/core/httpResponse'

export function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
  requestId?: string
) {
  return jsonNoStoreResponse(body, init, requestId)
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
