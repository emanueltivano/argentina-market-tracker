import 'server-only'

import type { NextRequest } from 'next/server'
import { isMarketDataPanelKey, type MarketDataPanelKey } from '@/lib/market'
import { canUseLocalDebug } from '@/lib/server/debug'

export function getPanelType(
  req: NextRequest
): { ok: true; type: MarketDataPanelKey } | { ok: false } {
  const type = req.nextUrl.searchParams.get('type')

  if (type === null) {
    return { ok: true, type: 'lider' }
  }

  return isMarketDataPanelKey(type) ? { ok: true, type } : { ok: false }
}

export function shouldReturnRawPanelData(req: NextRequest): boolean {
  return canUseLocalDebug(req) && req.nextUrl.searchParams.get('raw') === '1'
}

export function shouldBypassPanelCache(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get('refresh') === '1'
}
