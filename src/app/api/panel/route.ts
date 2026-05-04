import { NextResponse, type NextRequest } from 'next/server'
import { isMarketPanelKey, type MarketPanelKey } from '@/lib/market'
import { normalizePanelData, type PanelResponse } from '@/lib/panel'
import { ENV } from '@/lib/server/env'
import { iolFetch } from '@/lib/server/iol'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const PANEL_CACHE_TTL_MS = 30_000

type PanelCacheEntry = {
  response: PanelResponse
  expiresAt: number
}

const panelCache = new Map<MarketPanelKey, PanelCacheEntry>()
const inFlightPanelRequests = new Map<MarketPanelKey, Promise<PanelResponse>>()

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

function getPanelEndpoint(type: MarketPanelKey): string {
  switch (type) {
    case 'lider':
      return ENV.PANEL_LIDER_ENDPOINT
    case 'general':
      return ENV.PANEL_GENERAL_ENDPOINT
    case 'cedears':
      return ENV.PANEL_CEDEARS_ENDPOINT
  }
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

async function fetchPanelResponse(type: MarketPanelKey): Promise<PanelResponse> {
  const data = await iolFetch(getPanelEndpoint(type))
  const response: PanelResponse = {
    ok: true,
    data: normalizePanelData(data),
  }

  setCachedPanelResponse(type, response)
  return response
}

function getOrCreatePanelResponse(type: MarketPanelKey): Promise<PanelResponse> {
  const cached = getCachedPanelResponse(type)

  if (cached) {
    return Promise.resolve(cached)
  }

  const inFlight = inFlightPanelRequests.get(type)

  if (inFlight) {
    return inFlight
  }

  const promise = fetchPanelResponse(type).finally(() => {
    if (inFlightPanelRequests.get(type) === promise) {
      inFlightPanelRequests.delete(type)
    }
  })

  inFlightPanelRequests.set(type, promise)
  return promise
}

export function clearPanelCacheForTests() {
  panelCache.clear()
  inFlightPanelRequests.clear()
}

export async function GET(req: NextRequest) {
  const type = getPanelType(req)
  const shouldReturnRaw = shouldReturnRawData(req)

  try {
    if (shouldReturnRaw) {
      const data = await iolFetch(getPanelEndpoint(type))

      return NextResponse.json({
        ok: true,
        type,
        data,
      })
    }

    const response = await getOrCreatePanelResponse(type)

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
