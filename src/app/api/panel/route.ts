import { NextResponse, type NextRequest } from 'next/server'
import { isMarketPanelKey, type MarketPanelKey } from '@/lib/market'
import { normalizePanelData, type PanelResponse } from '@/lib/panel'
import { ENV } from '@/lib/server/env'
import { iolFetch } from '@/lib/server/iol'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const PANEL_CACHE_TTL_MS = 30_000

const PANEL_ENDPOINTS: Record<MarketPanelKey, string> = {
  lider: ENV.PANEL_LIDER_ENDPOINT,
  general: ENV.PANEL_GENERAL_ENDPOINT,
  cedears: ENV.PANEL_CEDEARS_ENDPOINT,
}

type PanelCacheEntry = {
  response: PanelResponse
  expiresAt: number
}

const panelCache = new Map<MarketPanelKey, PanelCacheEntry>()

function getPanelType(req: NextRequest): MarketPanelKey {
  const type = req.nextUrl.searchParams.get('type')

  return isMarketPanelKey(type) ? type : 'lider'
}

function isDebugEnabled() {
  return ENV.NODE_ENV !== 'production' && process.env.ENABLE_TOKEN_DEBUG === '1'
}

function shouldReturnRawData(req: NextRequest): boolean {
  return isDebugEnabled() && req.nextUrl.searchParams.get('raw') === '1'
}

function getCachedPanelResponse(type: MarketPanelKey): PanelResponse | null {
  const cached = panelCache.get(type)

  if (!cached || Date.now() >= cached.expiresAt) {
    panelCache.delete(type)
    return null
  }

  return cached.response
}

function setCachedPanelResponse(type: MarketPanelKey, response: PanelResponse) {
  panelCache.set(type, {
    response,
    expiresAt: Date.now() + PANEL_CACHE_TTL_MS,
  })
}

export async function GET(req: NextRequest) {
  const type = getPanelType(req)
  const shouldReturnRaw = shouldReturnRawData(req)

  try {
    if (!shouldReturnRaw) {
      const cached = getCachedPanelResponse(type)

      if (cached) {
        return NextResponse.json(cached)
      }
    }

    const data = await iolFetch(PANEL_ENDPOINTS[type])

    if (shouldReturnRaw) {
      return NextResponse.json({
        ok: true,
        type,
        data,
      })
    }

    const response: PanelResponse = {
      ok: true,
      data: normalizePanelData(data),
    }

    setCachedPanelResponse(type, response)

    return NextResponse.json(response)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? 'unknown')
    const isProd = ENV.NODE_ENV === 'production'

    return NextResponse.json(
      {
        ok: false,
        error: 'PANEL_ERROR',
        ...(isProd ? {} : { details: message }),
      },
      { status: 502 }
    )
  }
}

export function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: 'METHOD_NOT_ALLOWED',
    },
    {
      status: 405,
      headers: { Allow: 'GET' },
    }
  )
}
