import 'server-only'

import type { PanelErrorCode, PanelErrorResponse } from '@/lib/panel'
import { jsonResponse } from '@/lib/server/core/httpResponse'

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
