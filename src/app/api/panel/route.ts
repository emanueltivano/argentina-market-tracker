import type { NextRequest } from 'next/server'
import { ENV } from '@/lib/server/env'
import { iolFetch } from '@/lib/server/iol'
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

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export function clearPanelCacheForTests() {
  clearPanelResponseCacheForTests()
  clearPanelLimitsForTests()
}

export async function GET(req: NextRequest) {
  const panelType = getPanelType(req)

  if (!panelType.ok) {
    return panelErrorResponse('INVALID_PANEL_TYPE', { status: 400 })
  }

  const type = panelType.type
  const shouldReturnRaw = shouldReturnRawPanelData(req)
  const bypassCache = shouldBypassPanelCache(req)
  const rateLimit = checkPanelRateLimit(req)

  if (!rateLimit.ok) {
    return panelErrorResponse('RATE_LIMITED', {
      status: 429,
      headers: {
        'Retry-After': String(rateLimit.retryAfterSec),
      },
    })
  }

  // Local in-memory cooldown for manual refresh. In serverless this protects
  // only the current instance; it is not a global distributed limit.
  if (bypassCache && !hasInFlightPanelRefresh(type)) {
    const refreshCooldown = checkPanelRefreshCooldown(req, type)

    if (!refreshCooldown.ok) {
      return panelErrorResponse('REFRESH_COOLDOWN', {
        status: 429,
        headers: {
          'Retry-After': String(refreshCooldown.retryAfterSec),
        },
      })
    }
  }

  try {
    if (shouldReturnRaw) {
      const data = await iolFetch(getPanelEndpoint(type))

      return jsonResponse({
        ok: true,
        type,
        data,
      })
    }

    const response = await getOrCreatePanelResponse(type, bypassCache)

    return jsonResponse(response)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? 'unknown')
    const isProd = ENV.NODE_ENV === 'production'

    return panelErrorResponse(
      'PANEL_ERROR',
      { status: 502 },
      isProd ? undefined : message
    )
  }
}

export function POST() {
  return panelErrorResponse(
    'METHOD_NOT_ALLOWED',
    {
      status: 405,
      headers: { Allow: 'GET' },
    }
  )
}
